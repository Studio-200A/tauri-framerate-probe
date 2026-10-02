export function summarize(intervals, hz) {
  if (!intervals.length || !Number.isFinite(hz) || hz <= 0) throw new Error('Invalid samples or refresh rate');
  if (intervals.some(x => !Number.isFinite(x) || x <= 0)) throw new Error('Invalid frame interval');
  const sorted = [...intervals].sort((a, b) => a - b);
  const quantile = p => sorted[Math.ceil(p * sorted.length) - 1];
  const total = intervals.reduce((a, b) => a + b, 0);
  return { samples: intervals.length, durationMs: total, fps: intervals.length * 1000 / total,
    p50Ms: quantile(.5), p95Ms: quantile(.95), p99Ms: quantile(.99), maxMs: sorted.at(-1),
    longIntervalPercent: 100 * intervals.filter(x => x > 1500 / hz).length / intervals.length };
}
