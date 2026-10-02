import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../frontend/metrics.mjs';
test('165 Hz samples are measured at 165 FPS without long intervals', () => {
  const result = summarize(Array(165).fill(1000 / 165), 165);
  assert.ok(Math.abs(result.fps - 165) < .00001);
  assert.equal(result.longIntervalPercent, 0);
});
test('FPS uses elapsed time and includes stalls', () => {
  const result = summarize([10, 10, 10, 10, 60], 100);
  assert.equal(result.fps, 50);assert.equal(result.p95Ms, 60);assert.equal(result.longIntervalPercent, 20);
});
test('reject invalid inputs', () => {
  for (const [samples, hz] of [[[], 165], [[0], 165], [[NaN], 165], [[10], 0]]) assert.throws(() => summarize(samples, hz));
});
