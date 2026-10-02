import { readFile, readdir } from 'node:fs/promises';
import { summarize } from '../frontend/metrics.mjs';
const directory = new URL('../results/', import.meta.url);
for (const file of (await readdir(directory)).filter(name => /^frames-\d+\.json$/.test(name)).sort()) {
  const data = JSON.parse(await readFile(new URL(file, directory), 'utf8'));
  console.log(`\n${file} | ${data.environment.runtime?.gdkDisplayType ?? 'backend not recorded'} | near60: ${data.environment.runtime?.near60Feature?.effectiveEnabled ?? 'not recorded'} | DPR ${data.environment.devicePixelRatio} | complete: ${data.completed} | initial focus: ${data.environment.initialFocus}`);
  console.table(data.results.map(result => {
    const verified = summarize(result.intervalsMs, data.environment.targetHz);
    for (const key of Object.keys(verified)) {
      if (Math.abs(verified[key] - result[key]) > 1e-8) throw new Error(`${file}: ${key} verification failed`);
    }
    return {scene: result.mode, fps: verified.fps.toFixed(2), p50_ms: verified.p50Ms.toFixed(2), p95_ms: verified.p95Ms.toFixed(2), p99_ms: verified.p99Ms.toFixed(2), focusChanged: result.focusChanged};
  }));
}
