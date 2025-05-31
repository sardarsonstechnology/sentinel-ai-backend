const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const axios = require('axios');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// MongoDB model
const Signal = mongoose.model('Signal', new mongoose.Schema({
  asset: String,
  rsi: Number,
  signal: String,
  generated_at: Date,
}));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB connected');
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
});

// GET /api/assets — list unique asset symbols
app.get('/api/assets', async (req, res) => {
  try {
    const assets = await Signal.distinct('asset');
    res.json(assets);
  } catch (err) {
    console.error('❌ Error fetching assets:', err.message);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// GET /api/signals?symbol=AAPL
app.get('/api/signals', async (req, res) => {
  const symbol = req.query.symbol?.toUpperCase();
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!symbol) return res.status(400).json({ error: 'Missing symbol parameter' });
  if (!apiKey) return res.status(500).json({ error: 'API key not configured on server' });

  try {
    // Get real-time price data from Finnhub
    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
    const { data } = await axios.get(quoteUrl);

    const close = parseFloat(data.c);
    const high = parseFloat(data.h);
    const low = parseFloat(data.l);

    if (isNaN(close) || isNaN(high) || isNaN(low)) {
      return res.status(500).json({ error: 'Invalid data from Finnhub' });
    }

    // Calculate a simple RSI approximation
    const rsi = Math.min(100, Math.max(0, ((close - low) / (high - low)) * 100));

    let signal = 'hold';
    if (rsi > 70) signal = 'sell';
    else if (rsi < 30) signal = 'buy';

    // Save to DB
    const newSignal = new Signal({
      asset: symbol,
      rsi: Number(rsi.toFixed(2)),
      signal,
      generated_at: new Date(),
    });
    await newSignal.save();

    res.json({
      asset: symbol,
      rsi: newSignal.rsi,
      signal: newSignal.signal,
      generated_at: newSignal.generated_at,
    });

  } catch (err) {
    console.error('❌ Error in /api/signals:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Server listener
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
