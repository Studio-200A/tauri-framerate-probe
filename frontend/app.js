import { summarize } from './metrics.mjs';
const $ = id => document.getElementById(id);
const modes = [['idle', 'Idle rAF'], ['canvas', 'Canvas: 200 particles'], ['dom', 'DOM: 200 elements']];
const canvas = $('canvas'), ctx = canvas.getContext('2d');
const particles = Array.from({length: 200}, (_, i) => {
  const el = document.createElement('i'); el.className = 'particle'; $('dom').append(el);
  return {el, phase: i * 2.399963, speed: .4 + (i % 7) * .08};
});
let running = false, cancelled = false, latest, focusEvents = [];
let runtime = null;
function resize() {
  canvas.width = Math.round(canvas.clientWidth * devicePixelRatio);
  canvas.height = Math.round(canvas.clientHeight * devicePixelRatio);
}
new ResizeObserver(resize).observe($('stage'));
function draw(mode, time) {
  if (mode === 'idle') return;
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (mode === 'canvas') {ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#65e3b5';}
  for (const p of particles) {
    const t = time / 1000 * p.speed + p.phase;
    const x = (Math.sin(t) * .46 + .5) * (width - 8), y = (Math.cos(t * 1.3) * .44 + .5) * (height - 8);
    if (mode === 'dom') p.el.style.transform = `translate(${x}px,${y}px)`;
    else {ctx.beginPath();ctx.arc(x + 4, y + 4, 4, 0, Math.PI * 2);ctx.fill();}
  }
}
function measure(mode, duration, hz) {
  $('canvas').hidden = mode !== 'canvas'; $('dom').hidden = mode !== 'dom';
  return new Promise(resolve => {
    let started, last, sampledAt, lastUI = 0;
    const intervals = [], recent = [];
    function frame(t) {
      if (cancelled || document.hidden) return resolve(null);
      started ??= t;
      draw(mode, t);
      if (t - started >= 2000) {
        sampledAt ??= t;
        if (last !== undefined) { const dt = t - last; if (dt > 0) {intervals.push(dt);recent.push(dt);} }
        last = t;
      }
      if (t - lastUI >= 1000) {
        if (recent.length) {const s = summarize(recent, hz);$('fps').textContent = `${s.fps.toFixed(1)} FPS`;$('interval').textContent = `${s.p50Ms.toFixed(2)} ms / frame`;recent.length = 0;}
        $('status').textContent = t - started < 2000 ? 'Warming up…' : `Sampling: ${Math.min(duration, (t - sampledAt)/1000).toFixed(0)} / ${duration} seconds`;
        lastUI = t;
      }
      if (sampledAt !== undefined && t - sampledAt >= duration * 1000) resolve({mode, ...summarize(intervals, hz), intervalsMs: intervals});
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}
async function run() {
  if (running) return;
  const hz = Number($('hz').value), duration = Number($('seconds').value);
  if (!(hz >= 1 && hz <= 1000 && duration >= 5 && duration <= 120)) { $('status').textContent = 'Enter a valid refresh rate and sample duration.';return; }
  running = true;cancelled = false;latest = undefined;focusEvents = []; $('rows').replaceChildren();
  $('start').disabled = true;$('stop').disabled = false;$('export').disabled = true;$('hz').disabled = true;$('seconds').disabled = true;
  const results = [], environment = {runtime, userAgent: navigator.userAgent, devicePixelRatio, screen: {width: screen.width, height: screen.height}, viewport: {width: innerWidth, height: innerHeight}, targetHz: hz, secondsPerMode: duration, warmupSeconds: 2, startedAt: new Date().toISOString(), initialFocus: document.hasFocus(), visibilityState: document.visibilityState};
  for (const [mode, name] of modes) {
    $('mode').textContent = name;
    const before = focusEvents.length, result = await measure(mode, duration, hz);
    if (!result) break;
    result.focusChanged = focusEvents.length !== before; results.push(result);
    const row = document.createElement('tr');
    for (const value of [name, result.fps.toFixed(2), result.p50Ms.toFixed(2), result.p95Ms.toFixed(2), result.p99Ms.toFixed(2), `${result.longIntervalPercent.toFixed(1)}%`, result.focusChanged ? 'Focus changed' : 'Complete']) {const td = document.createElement('td');td.textContent = value;row.append(td);}
    $('rows').append(row);
  }
  latest = {environment, results, focusEvents, completed: results.length === modes.length, endedAt: new Date().toISOString()};
  $('status').textContent = latest.completed ? 'Test complete.' : 'Test cancelled (stopped or window hidden). Partial results do not represent a complete run.';
  if (window.__TAURI__) {
    try {const path = await window.__TAURI__.core.invoke('save_result', {result: latest});$('status').textContent += ` Saved: ${path}`;}
    catch (error) {$('status').textContent += ` Save failed: ${error}`;}
  }
  running = false;$('start').disabled = false;$('stop').disabled = true;$('export').disabled = false;$('hz').disabled = false;$('seconds').disabled = false;
  if (latest.completed && window.__TAURI__) await window.__TAURI__.core.invoke('finish_auto');
}
$('start').onclick = run;$('stop').onclick = () => {cancelled = true;};
document.addEventListener('visibilitychange', () => {if (running && document.hidden) cancelled = true;});
for (const type of ['focus', 'blur']) window.addEventListener(type, () => {if (running) focusEvents.push({type, at: new Date().toISOString()});});
$('export').onclick = () => {if (!latest) return;const url = URL.createObjectURL(new Blob([JSON.stringify(latest, null, 2)], {type:'application/json'}));const a = document.createElement('a');a.href=url;a.download=`frame-probe-${Date.now()}.json`;a.click();setTimeout(() => URL.revokeObjectURL(url), 1000);};
$('environment').textContent = `${navigator.userAgent}\nDPR: ${devicePixelRatio} · Screen: ${screen.width} × ${screen.height} · Viewport: ${innerWidth} × ${innerHeight}`;
// Opt-in automatic run for repeatable local measurements.
if (window.__TAURI__) {
  Promise.all([window.__TAURI__.core.invoke('runtime_info'), window.__TAURI__.core.invoke('auto_run')])
    .then(([info, auto]) => {
      if (info.reloadBeforeSampling) {location.reload();return;}
      runtime = info;$('environment').textContent += `\n${JSON.stringify(info)}`;if (auto) setTimeout(run, 1500);
    })
    .catch(error => {$('status').textContent = `Could not read the runtime configuration: ${error}`;});
}
