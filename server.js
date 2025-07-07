require('dotenv').config(); // MUST be at the top

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');

const calculateSignal = require('./utils/calculateSignal');
const updateAllSignals = require('./utils/updateAllSignals');

const Signal = require('./models/Signal');
const SignalHistory = require('./models/SignalHistory');

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Root route
app.get('/', (req, res) => {
  res.send('✅ Sentinel AI Backend is live');
});

// ✅ MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB connected');

  // 🔁 Auto-update signals every 3 minutes
  cron.schedule('*/3 * * * *', async () => {
    console.log('⏱️ Running signal auto-update...');
    await updateAllSignals();
  });

  // Run once on startup
  updateAllSignals();
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
});

// ✅ GET all unique asset names
app.get('/api/assets', async (req, res) => {
  try {
    const assets = await Signal.distinct('asset');
    res.json(assets);
  } catch (err) {
    console.error('❌ Fetching assets failed:', err.message);
    res.status(500).json({ error: 'Internal error fetching assets' });
  }
});

// ✅ GET latest signal per asset
app.get('/api/signals/all', async (req, res) => {
  try {
    const signals = await Signal.aggregate([
      { $sort: { generated_at: -1 } },
      {
        $group: {
          _id: '$asset',
          asset: { $first: '$asset' },
          rsi: { $first: '$rsi' },
          signal: { $first: '$signal' },
          generated_at: { $first: '$generated_at' },
        }
      },
      { $project: { _id: 0, asset: 1, rsi: 1, signal: 1, generated_at: 1 } }
    ]);

    res.json(signals);
  } catch (err) {
    console.error('❌ Failed to fetch all signals:', err.message);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

// ✅ GET latest signal for one symbol
app.get('/api/signals/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!symbol) return res.status(400).json({ error: 'Missing symbol' });
  if (!apiKey) return res.status(500).json({ error: 'Missing API key' });

  try {
    let signal = await Signal.findOne({ asset: symbol }).sort({ generated_at: -1 });

    const now = Date.now();
    const isStale = signal && now - new Date(signal.generated_at).getTime() > 5 * 60 * 1000;

    if (!signal || isStale) {
      const formatted = symbol.includes('/') ? symbol : `${symbol}/USD`;
      const url = `https://api.twelvedata.com/rsi?symbol=${formatted}&interval=1min&time_period=14&apikey=${apiKey}`;
      const response = await axios.get(url);

      const rsiStr = response.data?.values?.[0]?.rsi;
      const rsi = rsiStr ? parseFloat(rsiStr) : null;

      if (!rsi || isNaN(rsi)) {
        console.warn(`⚠️ Invalid RSI for ${symbol}`);
        return res.status(404).json({ error: 'RSI data not available' });
      }

      const signalValue = calculateSignal(rsi);
      signal = new Signal({ asset: symbol, rsi, signal: signalValue, generated_at: new Date() });
      await signal.save();

      const history = new SignalHistory({ asset: symbol, rsi, signal: signalValue, generated_at: new Date() });
      await history.save();

      console.log(`✅ ${symbol}: RSI ${rsi} → ${signalValue}`);
    }

    res.json({
      asset: signal.asset,
      rsi: signal.rsi,
      signal: signal.signal,
      generated_at: signal.generated_at,
    });
  } catch (err) {
    console.error(`❌ Error fetching ${symbol}:`, err.message);
    res.status(500).json({ error: 'Error fetching signal' });
  }
});

// ✅ GET RSI chart history from DB
app.get('/api/signals/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const history = await SignalHistory.find({ asset: symbol.toUpperCase() }).sort({ generated_at: 1 });

    const rsiData = history.map(h => h.rsi);
    res.json({ rsi_history: rsiData });
  } catch (err) {
    console.error('❌ Error fetching RSI history:', err.message);
    res.status(500).json({ error: 'Error fetching RSI history' });
  }
});

// ✅ GET live RSI values for charting (for frontend chart)
app.get('/api/rsi-history/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  const formatted = symbol.includes('/') ? symbol : `${symbol}/USD`;

  if (!symbol || !apiKey) {
    return res.status(400).json({ error: 'Missing symbol or API key' });
  }

  try {
    const url = `https://api.twelvedata.com/rsi?symbol=${formatted}&interval=5min&outputsize=25&apikey=${apiKey}`;
    const response = await axios.get(url);

    const values = response.data?.values;
    if (!values || !Array.isArray(values) || values.length === 0) {
      return res.status(500).json({ error: 'Invalid RSI data from provider' });
    }

    const rsiArray = values.map(v => parseFloat(v.rsi)).reverse(); // older to newer

    return res.json({
      symbol: symbol.toUpperCase(),
      values: rsiArray,
    });
  } catch (err) {
    console.error('❌ RSI chart fetch failed:', err.message);
    return res.status(500).json({ error: 'Failed to fetch RSI chart data' });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend live on port ${PORT}`);
});
