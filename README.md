# Country Cache API

A RESTful API that fetches country data and exchange rates, caches them into MySQL, computes a per-country `estimated_gdp`, and provides endpoints for querying and simple CRUD.

## Features

- `POST /countries/refresh`: fetch countries + exchange rates, compute estimated_gdp (population × random(1000–2000) ÷ exchange_rate), and upsert records into MySQL.
- `GET /countries`: list countries with optional filters `?region=...` and `?currency=...`, and sort `?sort=gdp_desc` (or `gdp_asc`).
- `GET /countries/:name`: get single country by name.
- `DELETE /countries/:name`: delete a country record.
- `GET /status`: total countries and last refresh timestamp.
- `GET /countries/image`: serves generated summary image `cache/summary.png`.

Validation & behavior highlights:
- If a country has multiple currencies, only the first currency code is used.
- If `currencies` array is empty → currency_code = null, exchange_rate = null, estimated_gdp = 0.
- If a currency code is not found in exchange rates → exchange_rate = null, estimated_gdp = null.
- Refresh operation is transactional — if external fetch fails, DB is not modified.
- On successful refresh, an image `cache/summary.png` is generated (top 5 by estimated_gdp, total count, timestamp).

## Requirements

- Node 18+ (tested)
- MySQL 8+ (or MySQL 5.7+) with permission to create DB/tables
- System libraries for `canvas` (node-canvas). On Linux you may need:
  - `libcairo2-dev`, `libpango1.0-dev`, `libjpeg-dev`, `libgif-dev`, `librsvg2-dev` (package names vary)
  - On macOS: `brew install pkg-config cairo pango libpng jpeg giflib librsvg`

## Setup

1. Clone/copy the project files into a folder.
2. `.env` and fill in your DB credentials and desired port.
3. Install dependencies:

```bash
npm install
