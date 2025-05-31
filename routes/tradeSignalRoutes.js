const express = require('express');
const router = express.Router();
const TradeSignal = require('../models/TradeSignal');

// POST - Create a new trade signal
router.post('/signal', async (req, res) => {
  try {
    const { asset, action, confidence } = req.body;
    const newSignal = new TradeSignal({ asset, action, confidence });
    await newSignal.save();
    res.status(201).json({ message: 'Signal created', newSignal });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET - Fetch all trade signals
router.get('/signals', async (req, res) => {
  try {
    const signals = await TradeSignal.find().sort({ generated_at: -1 });
    res.status(200).json(signals);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;