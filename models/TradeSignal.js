const mongoose = require('mongoose');

const tradeSignalSchema = new mongoose.Schema({
  asset: String,         // Example: "BTC", "AAPL", "ETH"
  action: String,        // Example: "BUY", "SELL", "HOLD"
  confidence: Number,    // Example: 92 (% confidence level)
  generated_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('TradeSignal', tradeSignalSchema);