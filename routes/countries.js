// routes/countries.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/countries.js');

// POST /countries/refresh
router.post('/refresh', ctrl.handleRefresh);

// GET /countries
router.get('/', ctrl.getCountries);

// GET /countries/image
router.get('/image', ctrl.getImage);

// GET /countries/:name
router.get('/:name', ctrl.getCountryByName);

// DELETE /countries/:name
router.delete('/:name', ctrl.deleteCountryByName);

module.exports = router;