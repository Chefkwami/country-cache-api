// utils/image.js
const fs = require('fs');
const path = require('path');
const { createCanvas, registerFont } = require('canvas');

const CACHE_IMAGE_PATH = process.env.CACHE_IMAGE_PATH || 'cache/summary.png';

async function generateSummaryImage({ totalCount, lastRefreshedAt, top5 }) {
    // create cache dir if not exists
    const dir = path.dirname(CACHE_IMAGE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const width = 1200;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // title
    ctx.fillStyle = '#222';
    ctx.font = 'bold 36px Sans';
    ctx.fillText('Country Cache Summary', 40, 64);

    // last refreshed and total
    ctx.font = '20px Sans';
    ctx.fillText(`Last refresh: ${lastRefreshedAt}`, 40, 110);
    ctx.fillText(`Total countries: ${totalCount}`, 40, 140);

    // top 5 table header
    ctx.font = '24px Sans';
    ctx.fillText('Top 5 Countries by estimated_gdp', 40, 190);

    ctx.font = '18px Sans';
    let y = 230;
    top5.forEach((c, idx) => {
        const text = `${idx + 1}. ${c.name} — ${c.estimated_gdp !== null ? Number(c.estimated_gdp).toLocaleString() : 'N/A'}`;
        ctx.fillText(text, 60, y);
        y += 34;
    });

    // small footer
    ctx.font = '14px Sans';
    ctx.fillText(`Generated at ${new Date().toISOString()}`, 40, height - 30);

    const buffer = canvas.toBuffer('image/png');

    await fs.promises.writeFile(CACHE_IMAGE_PATH, buffer);
    return CACHE_IMAGE_PATH;
}

module.exports = {
    generateSummaryImage
};