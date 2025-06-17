const axios = require('axios');
const Signal = require('../models/Signal');
const SignalHistory = require('../models/SignalHistory');
const calculateSignal = require('./calculateSignal');

const apiKey = process.env.TWELVE_DATA_API_KEY;

// Assets to track (add more as needed)
const assetList = ['AAPL', 'TSLA', 'AMZN', 'GOOGL', 'MSFT', 'BTC/USD', 'ETH/USD'];

// Format symbols for Twelve Data API
function formatSymbol(symbol) {
  return symbol.includes('USD') && !symbol.includes('/')
    ? `${symbol.slice(0, 3)}/${symbol.slice(3)}`
    : symbol;
}

// Main signal updater
const updateAllSignals = async () => {
  console.log('🔁 Auto-updating signals...');
  for (const symbol of assetList) {
    try {
      const formatted = formatSymbol(symbol);
      const url = `https://api.twelvedata.com/rsi?symbol=${formatted}&interval=1min&time_period=14&apikey=${apiKey}`;
      const response = await axios.get(url);

      const rsiStr = response.data?.values?.[0]?.rsi;
      const rsi = rsiStr ? parseFloat(rsiStr) : null;

      if (!rsi || isNaN(rsi)) {
        console.warn(`⚠️ RSI not available for ${symbol}`);
        continue;
      }

      const signalValue = calculateSignal(rsi);

      // Save latest signal
      const newSignal = new Signal({
        asset: symbol,
        rsi,
        signal: signalValue,
        generated_at: new Date(),
      });
      await newSignal.save();

      // Also save historical data
      const historical = new SignalHistory({
        asset: symbol,
        rsi,
        signal: signalValue,
        generated_at: new Date(),
      });
      await historical.save();

      console.log(`✅ ${symbol}: RSI ${rsi} → ${signalValue}`);
    } catch (err) {
      console.error(`❌ Failed to update ${symbol}:`, err.message);
    }
  }
};

module.exports = updateAllSignals;
