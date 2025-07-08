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
  priceChange: Number, // ✅ Stored for ticker
}));

// ✅ Load asset list from file
function loadAssetSymbols() {
  const content = fs.readFileSync('final_supported_assets.txt', 'utf-8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

// ✅ Fetch RSI
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

// ✅ Fetch current price
async function fetchCurrentPrice(symbol) {
  try {
    const encodedSymbol = encodeURIComponent(symbol);
    const url = `https://api.twelvedata.com/price?symbol=${encodedSymbol}&apikey=${TWELVE_DATA_API_KEY}`;
    const response = await axios.get(url);
    const price = parseFloat(response.data?.price);
    return isNaN(price) ? null : price;
  } catch (err) {
    console.error(`❌ Error fetching price for ${symbol}:`, err.message);
    return null;
  }
}

// ✅ Fetch previous close
async function fetchPreviousClose(symbol) {
  try {
    const encodedSymbol = encodeURIComponent(symbol);
    const url = `https://api.twelvedata.com/time_series?symbol=${encodedSymbol}&interval=1day&outputsize=2&apikey=${TWELVE_DATA_API_KEY}`;
    const response = await axios.get(url);
    const values = response.data?.values;
    const close = values?.[1]?.close;
    const previous = parseFloat(close);
    return isNaN(previous) ? null : previous;
  } catch (err) {
    console.error(`❌ Error fetching previous close for ${symbol}:`, err.message);
    return null;
  }
}

// 🔄 Main updater
async function updateSignals() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  await Signal.deleteMany({ asset: "ALL" });

  const assetSymbols = loadAssetSymbols();

  for (const symbol of assetSymbols) {
    console.log(`🔄 ${symbol}`);

    const [rsi, currentPrice, previousPrice] = await Promise.all([
      fetchRSI(symbol),
      fetchCurrentPrice(symbol),
      fetchPreviousClose(symbol),
    ]);

    if (rsi === null || currentPrice === null || previousPrice === null) {
      console.warn(`⚠️ Skipped ${symbol} due to missing data`);
      continue;
    }

    const signal = calculateSignal(rsi);
    const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;

    await Signal.findOneAndUpdate(
      { asset: symbol.toUpperCase() },
      {
        asset: symbol.toUpperCase(),
        rsi,
        signal,
        generated_at: new Date(),
        priceChange: parseFloat(priceChange.toFixed(2)),
      },
      { upsert: true }
    );

    console.log(`✅ ${symbol} → RSI: ${rsi}, Δ: ${priceChange.toFixed(2)}%`);
  }

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

updateSignals();
