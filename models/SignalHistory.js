const mongoose = require('mongoose');

const signalHistorySchema = new mongoose.Schema({
  asset: { type: String, required: true },
  rsi: { type: Number, required: true },
  signal: { type: String, required: true },
  generated_at: { type: Date, required: true },
  confidence: { type: Number, required: false },
  action: { type: String, required: false },
});

module.exports = mongoose.model('SignalHistory', signalHistorySchema);
