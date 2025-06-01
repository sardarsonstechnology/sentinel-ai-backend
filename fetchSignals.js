const axios = require('axios');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const calculateSignal = require('./utils/calculateSignal');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;

const Signal = mongoose.model('Signal', new mongoose.Schema({
  asset: String,
  rsi: Number,
  signal: String,
  generated_at: Date,
}));

const majorSymbols = ['AAPL', 'AMZN', 'TSLA', 'MSFT', 'GOOGL'];

async function fetchRSI(symbol) {
  try {
    const url = `https://api.twelvedata.com/rsi?symbol=${symbol}&interval=1day&time_period=14&apikey=${TWELVE_DATA_API_KEY}`;
    const response = await axios.get(url);

    const rsiValue = response.data?.values?.[0]?.rsi;
    if (!rsiValue) {
      console.error(`❌ No RSI found in response for ${symbol}`);
      return null;
    }

    return parseFloat(rsiValue);
  } catch (err) {
    console.error(`❌ Error fetching RSI for ${symbol}:`, err.message);
    return null;
  }
}

async function updateSignals() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  for (const symbol of majorSymbols) {
    const rsi = await fetchRSI(symbol);
    if (rsi === null) continue;

    const signal = calculateSignal(rsi);
    await Signal.findOneAndUpdate(
      { asset: symbol },
      { rsi, signal, generated_at: new Date() },
      { upsert: true }
    );

    console.log(`✅ Signal updated for ${symbol}: RSI=${rsi}, Signal=${signal}`);
  }

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB');
}

updateSignals();
