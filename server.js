const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const axios = require('axios');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// ✅ Define MongoDB Schema & Model
const SignalSchema = new mongoose.Schema({
  asset: { type: String, required: true },
  rsi: { type: Number, required: true },
  signal: { type: String, required: true },
  generated_at: { type: Date, default: Date.now },
});

const Signal = mongoose.model('Signal', SignalSchema);

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch((err) => {
  console.error('❌ MongoDB connection failed:', err.message);
  process.exit(1); // Exit if DB connection fails
});

// ✅ GET: All Unique Asset Symbols
app.get('/api/assets', async (req, res) => {
  try {
    const assets = await Signal.distinct('asset');
    res.json(assets);
  } catch (err) {
    console.error('❌ Error fetching asset list:', err.message);
    res.status(500).json({ error: 'Failed to fetch asset list' });
  }
});

// ✅ GET: Latest Signal for Given Symbol with Real-Time Change %
app.get('/api/signals', async (req, res) => {
  const symbol = req.query.symbol?.toUpperCase();
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!symbol) return res.status(400).json({ error: 'Missing symbol parameter' });
  if (!apiKey) return res.status(500).json({ error: 'Server misconfigured: API key missing' });

  try {
    const signal = await Signal.findOne({ asset: symbol }).sort({ generated_at: -1 });
    if (!signal) return res.status(404).json({ error: `No signal found for ${symbol}` });

    const { data } = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`);

    const current = parseFloat(data.c);
    const previous = parseFloat(data.pc);

    const change =
      !isNaN(current) && !isNaN(previous) && previous !== 0
        ? Number((((current - previous) / previous) * 100).toFixed(2))
        : null;

    res.json({
      asset: signal.asset,
      rsi: signal.rsi,
      signal: signal.signal,
      change,
      generated_at: signal.generated_at,
    });

  } catch (err) {
    console.error('❌ Error fetching signal:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server live at http://localhost:${PORT}`));
