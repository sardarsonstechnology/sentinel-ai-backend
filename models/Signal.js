const mongoose = require('mongoose');

const SignalSchema = new mongoose.Schema({
    asset: {
        type: String,
        required: true,
    },
    action: {
        type: String,
        required: true,
    },
    confidence: {
        type: Number,
        required: true,
    },
    generated_at: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Signal', SignalSchema);