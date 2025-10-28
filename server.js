// app.js
require('dotenv').config();
const express = require('express');
const countriesRoutes = require('./routes/countries.js');
const statusCtrl = require('./controllers/countries.js');
const app = express();

app.use(express.json());

// routes
app.use('/countries', countriesRoutes);

// GET /status
app.get('/status', statusCtrl.getStatus);

// Health
app.get('/', (req, res) => res.json({ message: 'Country Cache API' }));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`Country Cache API listening on port ${port}`);
});