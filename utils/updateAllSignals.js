const axios = require('axios');
const Signal = require('../models/Signal');
const SignalHistory = require('../models/SignalHistory');
const calculateSignal = require('./calculateSignal');

const apiKey = process.env.TWELVE_DATA_API_KEY;

// List all assets you want to update
const assetList = ['AAPL', 'TSLA', 'AMZN', 'GOOGL', 'MSFT', 'BTCUSD', 'ETHUSD'];

function formatSymbol(symbol) {
  return symbol.includes('USD') && !symbol.includes('/')
    ? `${symbol.slice(0, 3)}/${symbol.slice(3)}`
    : symbol;
}

const updateAllSignals = async () => {
  console.log('🔁 Auto-updating signals...');

  for (const symbol of assetList) {
    try {
      const formatted = formatSymbol(symbol);
      const url = `https://api.twelvedata.com/rsi?symbol=${formatted}&interval=1day&time_period=14&apikey=${apiKey}`;
      const response = await axios.get(url);
      const rsiStr = response.data?.values?.[0]?.rsi;
      const rsi = rsiStr ? parseFloat(rsiStr) : null;

      if (!rsi || isNaN(rsi)) {
        console.warn(`⚠️ RSI not available for ${symbol}`);
        continue;
      }

      const signalValue = calculateSignal(rsi);

      // ⏺️ Save the latest signal (overwrite if exists)
      await Signal.findOneAndUpdate(
        { asset: symbol },
        {
          action: signalValue,
          confidence: 1, // Placeholder if you don't use this
          generated_at: new Date(),
        },
        { upsert: true }
      );

      // 🆕 Save to historical collection
      await SignalHistory.create({
        asset: symbol,
        rsi,
        signal: signalValue,
        generated_at: new Date(),
      });

      console.log(`✅ ${symbol}: RSI ${rsi} → ${signalValue}`);
    } catch (err) {
      console.error(`❌ Failed to update ${symbol}:`, err.message);
    }
  }
};

module.exports = updateAllSignals;
