const axios = require("axios");
const mongoose = require("mongoose");
require("dotenv").config();
const Signal = require("./models/Signal");

const symbols = ["AAPL", "TSLA", "BTC/USD", "ETH/USD"]; // Add more as needed

const fetchRSI = async (symbol) => {
  try {
    const url = `https://api.twelvedata.com/rsi?symbol=${symbol}&interval=1min&time_period=14&apikey=${process.env.TWELVE_DATA_API_KEY}`;
    const response = await axios.get(url);
    const rsi = parseFloat(response.data.values?.[0]?.rsi);

    if (isNaN(rsi)) {
      console.error(`❌ Not enough data to calculate RSI for ${symbol}`);
      return null;
    }

    return rsi;
  } catch (error) {
    console.error(`❌ Error fetching RSI for ${symbol}:`, error.message);
    return null;
  }
};

const determineSignal = (rsi) => {
  if (rsi > 70) return "SELL";
  if (rsi < 30) return "BUY";
  return "HOLD";
};

const fetchAndStoreSignals = async () => {
  console.log("🔁 Fetching RSI signals from Twelve Data...");

  for (const symbol of symbols) {
    const rsi = await fetchRSI(symbol);
    if (rsi === null) continue;

    const action = determineSignal(rsi);

    try {
      await Signal.create({
        asset: symbol,
        confidence: rsi,
        action: action
      });
      console.log(`✅ Saved signal for ${symbol}: RSI = ${rsi.toFixed(2)} | Signal: ${action}`);
    } catch (error) {
      console.error(`❌ Failed to save signal for ${symbol}:`, error.message);
    }
  }

  console.log("✅ Signal generation complete.");
};

module.exports = fetchAndStoreSignals;
