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
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// GET /api/assets — List distinct assets
app.get('/api/assets', async (req, res) => {
  try {
    const assets = await Signal.distinct('asset');
    res.json(assets);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// GET /api/signals?symbol=AAPL — Get latest signal or generate if missing
app.get('/api/signals', async (req, res) => {
  const symbol = req.query.symbol?.toUpperCase();
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!symbol) return res.status(400).json({ error: 'Missing symbol parameter' });
  if (!apiKey) return res.status(500).json({ error: 'Missing API key on server' });

  try {
    let signal = await Signal.findOne({ asset: symbol }).sort({ generated_at: -1 });

    if (!signal || Date.now() - signal.generated_at > 24 * 60 * 60 * 1000) {
      const candlesUrl = `https://finnhub.io/api/v1/indicator?symbol=${symbol}&resolution=D&indicator=rsi&timeperiod=14&token=${apiKey}`;
      const response = await axios.get(candlesUrl);
      const rsiValues = response.data.rsi;

      if (!rsiValues || rsiValues.length === 0) {
        return res.status(404).json({ error: 'RSI data not available' });
      }

      const latestRSI = parseFloat(rsiValues[rsiValues.length - 1]);
      const signalValue = calculateSignal(latestRSI);

      signal = new Signal({
        asset: symbol,
        rsi: latestRSI,
        signal: signalValue,
        generated_at: new Date()
      });

      await signal.save();
      console.log(`📊 Generated & saved new signal for ${symbol}`);
    }

    res.json({
      asset: signal.asset,
      rsi: signal.rsi,
      signal: signal.signal,
      generated_at: signal.generated_at,
    });

  } catch (err) {
    console.error(`❌ Error generating signal for ${symbol}:`, err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Server port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server live on port ${PORT}`));
