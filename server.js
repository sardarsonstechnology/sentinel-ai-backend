const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const axios = require('axios');
const calculateSignal = require('./utils/calculateSignal');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Root route (health check)
app.get('/', (req, res) => {
  res.send('✅ Sentinel AI Backend is live');
});

// MongoDB Signal model
const Signal = mongoose.model('Signal', new mongoose.Schema({
  asset: String,
  rsi: Number,
  signal: String,
  generated_at: Date,
}));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
});

// GET /api/assets — List all distinct assets
app.get('/api/assets', async (req, res) => {
  try {
    const assets = await Signal.distinct('asset');
    res.json(assets);
  } catch (err) {
    console.error('❌ Failed to fetch assets:', err.message);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// ✅ GET /api/signals/all — Return latest signal per asset
app.get('/api/signals/all', async (req, res) => {
  try {
    const latestSignals = await Signal.aggregate([
      { $sort: { generated_at: -1 } },
      {
        $group: {
          _id: '$asset',
          asset: { $first: '$asset' },
          rsi: { $first: '$rsi' },
          signal: { $first: '$signal' },
          generated_at: { $first: '$generated_at' },
        },
      },
      {
        $project: {
          _id: 0,
          asset: 1,
          rsi: 1,
          signal: 1,
          generated_at: 1,
        },
      },
    ]);

    res.json(latestSignals);
  } catch (err) {
    console.error('❌ Failed to fetch all signals:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/signals/:symbol — Fetch or generate RSI signal
app.get('/api/signals/:symbol', async (req, res) => {
  const symbol = req.params.symbol?.toUpperCase();
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!symbol) return res.status(400).json({ error: 'Missing symbol parameter' });
  if (!apiKey) return res.status(500).json({ error: 'Missing API key on server' });

  try {
    let signal = await Signal.findOne({ asset: symbol }).sort({ generated_at: -1 });

    const now = Date.now();
    const isStale = signal && now - new Date(signal.generated_at).getTime() > 24 * 60 * 60 * 1000;

    if (!signal || isStale) {
      const url = `https://api.twelvedata.com/rsi?symbol=${symbol}&interval=1day&time_period=14&apikey=${apiKey}`;
      const response = await axios.get(url);

      const rsiStr = response.data?.values?.[0]?.rsi;
      const rsi = rsiStr ? parseFloat(rsiStr) : null;

      if (!rsi || isNaN(rsi)) {
        console.warn(`⚠️ RSI not available for ${symbol}`);
        return res.status(404).json({ error: 'RSI data not available' });
      }

      const signalValue = calculateSignal(rsi);
      signal = new Signal({
        asset: symbol,
        rsi,
        signal: signalValue,
        generated_at: new Date()
      });

      await signal.save();
      console.log(`✅ ${symbol}: RSI ${rsi} → ${signalValue}`);
    }

    res.json({
      asset: signal.asset,
      rsi: signal.rsi,
      signal: signal.signal,
      generated_at: signal.generated_at,
    });

  } catch (err) {
    console.error(`❌ Error for ${symbol}:`, err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend live on port ${PORT}`);
});
