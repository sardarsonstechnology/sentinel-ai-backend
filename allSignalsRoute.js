const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Signal = mongoose.model('Signal', new mongoose.Schema({
  asset: String,
  rsi: Number,
  signal: String,
  generated_at: Date,
}));

router.get('/all', async (req, res) => {
  try {
    const allSignals = await Signal.find({});
    res.json(allSignals); // ✅ return an array
  } catch (err) {
    console.error('Error in /api/signals/all:', err.message);
    res.status(500).json({ error: 'Failed to load signals' });
  }
});

module.exports = router;
