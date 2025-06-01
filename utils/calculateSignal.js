module.exports = function calculateSignal(rsi) {
    if (rsi > 70) return 'sell';
    if (rsi < 30) return 'buy';
    return 'hold';
  };
  