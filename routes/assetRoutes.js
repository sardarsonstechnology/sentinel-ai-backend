const express = require('express');
const router = express.Router();
const TradeSignal = require('../models/TradeSignal');

// GET /api/assets - Return distinct asset names from TradeSignal collection
router.get('/assets', async (req, res) => {
  try {
    const assets = await TradeSignal.distinct('asset');
    res.json(assets);
  } catch (err) {
    console.error('Error fetching assets:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
