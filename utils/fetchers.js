// utils/fetchers.js
const axios = require('axios');

const COUNTRIES_URL = 'https://restcountries.com/v2/all?fields=name,capital,region,population,flag,currencies';
const RATES_URL = 'https://open.er-api.com/v6/latest/USD';

const DEFAULT_TIMEOUT = Number(process.env.EXTERNAL_TIMEOUT_MS || 15000);

async function fetchAllCountries() {
    try {
        const res = await axios.get(COUNTRIES_URL, { timeout: DEFAULT_TIMEOUT });
        return res.data;
    } catch (err) {
        const e = new Error('Could not fetch data from Countries API');
        e.source = 'countries';
        throw e;
    }
}

async function fetchRates() {
    try {
        const res = await axios.get(RATES_URL, { timeout: DEFAULT_TIMEOUT });
        // The API returns structure: {result: 'success', rates: { ... }, time_last_update_utc: ...}
        // We'll return the rates object
        if (!res.data || !res.data.rates) {
            const e = new Error('Rates payload malformed');
            e.source = 'rates';
            throw e;
        }
        return res.data.rates;
    } catch (err) {
        const e = new Error('Could not fetch data from Exchange Rates API');
        e.source = 'rates';
        throw e;
    }
}

module.exports = {
    fetchAllCountries,
    fetchRates
};