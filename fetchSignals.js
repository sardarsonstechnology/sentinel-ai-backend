const axios = require('axios');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
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

// Read supported assets from file
function loadAssetSymbols() {
  const content = fs.readFileSync('final_supported_assets.txt', 'utf-8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

async function fetchRSI(symbol) {
  try {
    const encodedSymbol = encodeURIComponent(symbol);
    const url = `https://api.twelvedata.com/rsi?symbol=${encodedSymbol}&interval=1day&time_period=14&apikey=${TWELVE_DATA_API_KEY}`;
    const response = await axios.get(url);
    const rsiValue = response.data?.values?.[0]?.rsi;

    if (!rsiValue) {
      console.warn(`⚠️ No RSI for ${symbol}`);
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

  await Signal.deleteMany({ asset: "ALL" });

  const assetSymbols = loadAssetSymbols();

  for (const symbol of assetSymbols) {
    console.log(`🔄 ${symbol}`);
    const rsi = await fetchRSI(symbol);
    if (rsi === null) continue;

    const signal = calculateSignal(rsi);

    await Signal.findOneAndUpdate(
      { asset: symbol.toUpperCase() },
      {
        asset: symbol.toUpperCase(),
        rsi,
        signal,
        generated_at: new Date(),
      },
      { upsert: true }
    );

    console.log(`✅ ${symbol}: RSI=${rsi}, Signal=${signal}`);
  }

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

updateSignals();
