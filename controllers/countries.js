// controllers/countries.js
const pool = require('../db.js');
const { fetchAllCountries, fetchRates } = require('../utils/fetchers.js');
const { generateSummaryImage } = require('../utils/image.js');

const CACHE_IMAGE_PATH = process.env.CACHE_IMAGE_PATH || 'cache/summary.png';

// helper: compute multiplier
function randomMultiplier() {
    return Math.random() * (2000 - 1000) + 1000;
}

function makeError(status, message, details = undefined) {
    const body = { error: message };
    if (details) body.details = details;
    return { status, body };
}

async function handleRefresh(req, res) {
    // 1) fetch both external APIs first
    let countriesPayload;
    let rates;
    try {
        [countriesPayload, rates] = await Promise.all([fetchAllCountries(), fetchRates()]);
    } catch (err) {
        // external API failure: respond 503 and do NOT modify DB
        const sourceName = err.source === 'rates' ? 'Exchange Rates API' : (err.source === 'countries' ? 'Countries API' : 'External API');
        return res.status(503).json({
            error: 'External data source unavailable',
            details: `Could not fetch data from ${sourceName}`
        });
    }

    // Begin a DB transaction; if anything fails, rollback and respond 500
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // For each country from payload, compute fields and upsert
        const now = new Date();

        // Prepare statements
        const upsertSql = `
      INSERT INTO countries
      (name, capital, region, population, currency_code, exchange_rate, estimated_gdp, flag_url, last_refreshed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        capital = VALUES(capital),
        region = VALUES(region),
        population = VALUES(population),
        currency_code = VALUES(currency_code),
        exchange_rate = VALUES(exchange_rate),
        estimated_gdp = VALUES(estimated_gdp),
        flag_url = VALUES(flag_url),
        last_refreshed_at = VALUES(last_refreshed_at)
    `;

        for (const c of countriesPayload) {
            // Fields from external
            const name = c.name || null;
            const capital = c.capital || null;
            const region = c.region || null;
            const population = c.population === undefined || c.population === null ? null : Number(c.population);
            const flag_url = c.flag || null;

            // currency handling: take first currency code if exists
            let currency_code = null;
            if (Array.isArray(c.currencies) && c.currencies.length > 0 && c.currencies[0] && c.currencies[0].code) {
                currency_code = c.currencies[0].code || null;
            } else {
                currency_code = null;
            }

            // validation: the refresh process stores rows even when currency_code is null per spec
            // exchange_rate handling:
            let exchange_rate = null;
            let estimated_gdp = null;

            if (currency_code === null) {
                // per spec: don't call exchange rate, set exchange_rate=null, estimated_gdp=0
                exchange_rate = null;
                estimated_gdp = 0;
            } else {
                // Try match currency in rates mapping
                const rate = rates[currency_code];
                if (rate === undefined || rate === null) {
                    exchange_rate = null;
                    estimated_gdp = null;
                } else {
                    exchange_rate = Number(rate);
                    // compute estimated_gdp = population × random(1000–2000) ÷ exchange_rate
                    const popVal = population === null ? 0 : population;
                    const multiplier = randomMultiplier();
                    estimated_gdp = (popVal * multiplier) / exchange_rate;
                }
            }

            // If population or name missing - however spec says we should store countries and population is required.
            // Countries API usually has population and name. We'll set population to 0 if missing.
            const populationFinal = population === null ? 0 : population;

            // Upsert
            await conn.execute(
                upsertSql, [
                    name, capital, region, populationFinal, currency_code, exchange_rate, estimated_gdp, flag_url, now
                ]
            );
        }

        // update metadata last_refreshed_at
        await conn.execute(
            `INSERT INTO metadata (\`key\`, \`value\`) VALUES ('last_refreshed_at', ?) ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`, [now.toISOString()]
        );

        // commit
        await conn.commit();

        // After successful commit: generate summary image.
        // Get total count and top 5 by estimated_gdp
        const [countRows] = await pool.execute('SELECT COUNT(*) AS cnt FROM countries');
        const totalCount = countRows[0].cnt || 0;
        const [topRows] = await pool.execute(`
      SELECT name, estimated_gdp
      FROM countries
      WHERE estimated_gdp IS NOT NULL
      ORDER BY estimated_gdp DESC
      LIMIT 5
    `);

        await generateSummaryImage({
            totalCount,
            lastRefreshedAt: now.toISOString(),
            top5: topRows
        });

        return res.status(200).json({ message: 'Refresh completed', total_countries: totalCount, last_refreshed_at: now.toISOString() });
    } catch (err) {
        await conn.rollback();
        console.error('Refresh error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    } finally {
        conn.release();
    }
}

async function getCountries(req, res) {
    try {
        const { region, currency, sort } = req.query;

        // Base SQL
        let sql = 'SELECT id, name, capital, region, population, currency_code, exchange_rate, estimated_gdp, flag_url, last_refreshed_at FROM countries';
        const where = [];
        const params = [];

        if (region) {
            where.push('region = ?');
            params.push(region);
        }
        if (currency) {
            where.push('currency_code = ?');
            params.push(currency);
        }
        if (where.length) sql += ' WHERE ' + where.join(' AND ');

        // Sorting
        if (sort === 'gdp_desc') {
            sql += ' ORDER BY estimated_gdp DESC';
        } else if (sort === 'gdp_asc') {
            sql += ' ORDER BY estimated_gdp ASC';
        } else {
            sql += ' ORDER BY name ASC';
        }

        const [rows] = await pool.execute(sql, params);

        // convert DATETIME to ISO strings
        const out = rows.map(r => ({
            id: r.id,
            name: r.name,
            capital: r.capital,
            region: r.region,
            population: Number(r.population),
            currency_code: r.currency_code,
            exchange_rate: r.exchange_rate === null ? null : Number(r.exchange_rate),
            estimated_gdp: r.estimated_gdp === null ? null : Number(r.estimated_gdp),
            flag_url: r.flag_url,
            last_refreshed_at: r.last_refreshed_at ? new Date(r.last_refreshed_at).toISOString() : null
        }));

        return res.json(out);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function getCountryByName(req, res) {
    try {
        const name = req.params.name;
        if (!name) return res.status(400).json({ error: 'Validation failed', details: { name: 'is required' } });

        const [rows] = await pool.execute('SELECT id, name, capital, region, population, currency_code, exchange_rate, estimated_gdp, flag_url, last_refreshed_at FROM countries WHERE name = ?', [name]);

        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Country not found' });
        }

        const r = rows[0];
        return res.json({
            id: r.id,
            name: r.name,
            capital: r.capital,
            region: r.region,
            population: Number(r.population),
            currency_code: r.currency_code,
            exchange_rate: r.exchange_rate === null ? null : Number(r.exchange_rate),
            estimated_gdp: r.estimated_gdp === null ? null : Number(r.estimated_gdp),
            flag_url: r.flag_url,
            last_refreshed_at: r.last_refreshed_at ? new Date(r.last_refreshed_at).toISOString() : null
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function deleteCountryByName(req, res) {
    try {
        const name = req.params.name;
        if (!name) return res.status(400).json({ error: 'Validation failed', details: { name: 'is required' } });

        const [result] = await pool.execute('DELETE FROM countries WHERE name = ?', [name]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Country not found' });
        }
        return res.json({ message: 'Country deleted' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function getStatus(req, res) {
    try {
        const [countRows] = await pool.execute('SELECT COUNT(*) AS cnt FROM countries');
        const total = countRows[0].cnt || 0;

        const [metaRows] = await pool.execute("SELECT `value` FROM metadata WHERE `key` = 'last_refreshed_at' LIMIT 1");
        const last = metaRows.length ? metaRows[0].value : null;

        return res.json({
            total_countries: total,
            last_refreshed_at: last
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

const path = require('path');
const fs = require('fs');

async function getImage(req, res) {
    try {
        const p = path.resolve(process.env.CACHE_IMAGE_PATH || 'cache/summary.png');
        if (!fs.existsSync(p)) {
            return res.status(404).json({ error: 'Summary image not found' });
        }
        return res.sendFile(p);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    handleRefresh,
    getCountries,
    getCountryByName,
    deleteCountryByName,
    getStatus,
    getImage
};