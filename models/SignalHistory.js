const mongoose = require('mongoose');

const SignalHistorySchema = new mongoose.Schema({
  asset: {
    type: String,
    required: true,
  },
  rsi: {
    type: Number,
    required: true,
  },
  signal: {
    type: String,
    required: true,
  },
  generated_at: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('SignalHistory', SignalHistorySchema);
