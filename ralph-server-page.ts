export const progressPage = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ralph · Progress</title>
<style>
:root{color-scheme:light dark;--bg:oklch(97.8% .006 155);--surface:oklch(99.4% .003 155);--ink:oklch(25% .012 155);--muted:oklch(47% .015 155);--line:oklch(87% .012 155);--soft:oklch(94.5% .01 155);--accent:oklch(39% .085 155);--accent-bg:oklch(94% .025 155);--danger:oklch(43% .13 28);--danger-bg:oklch(96% .02 28)}
@media(prefers-color-scheme:dark){:root{--bg:oklch(19% .008 155);--surface:oklch(23% .008 155);--ink:oklch(93% .006 155);--muted:oklch(73% .012 155);--line:oklch(36% .012 155);--soft:oklch(28% .01 155);--accent:oklch(78% .08 155);--accent-bg:oklch(28% .03 155);--danger:oklch(80% .09 28);--danger-bg:oklch(27% .03 28)}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}button,input,select{font:inherit;color:inherit}button,select,input[type=search]{border:1px solid var(--line);border-radius:6px;background:var(--surface);padding:8px 11px}button,summary,select{cursor:pointer}button:hover,summary:hover{background:var(--soft)}:focus-visible{outline:2px solid var(--accent);outline-offset:3px}header{border-bottom:1px solid var(--line);background:var(--surface)}.top{max-width:1120px;margin:auto;padding:17px 32px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{font-weight:750;font-size:17px;letter-spacing:-.04em}.brand span{font-weight:400;color:var(--muted);letter-spacing:0;margin-left:14px;font-size:13px}.connection{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted)}.dot{width:7px;height:7px;border-radius:50%;background:var(--accent)}.connection.offline .dot{background:var(--danger)}main{max-width:1120px;margin:auto;padding:38px 32px 60px}h1{margin:0;font-size:30px;line-height:1.2;letter-spacing:-.035em;font-weight:650}.title{display:flex;justify-content:space-between;gap:20px;align-items:center}.path{margin:10px 0 25px;color:var(--muted);font:12px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}.goal{font-size:17px;max-width:72ch;margin:0 0 24px;white-space:pre-wrap;overflow-wrap:anywhere}.facts{display:flex;flex-wrap:wrap;gap:16px 36px;padding:18px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-bottom:28px}.fact{display:flex;gap:10px;align-items:baseline;font-size:13px}.fact span{color:var(--muted)}.fact strong{font-weight:600}.toolbar{display:flex;gap:12px;align-items:end;margin-bottom:22px;flex-wrap:wrap}.field{display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--muted)}.field input,.field select{font-size:14px;color:var(--ink)}.search{flex:1;min-width:180px}select{max-width:100%;min-width:200px}.live{font-size:13px;display:flex;align-items:center;gap:7px;padding-bottom:9px;white-space:nowrap}input[type=checkbox]{accent-color:var(--accent);width:16px;height:16px}.activity-heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:8px}h2{font-size:17px;margin:0;font-weight:650}.count{font-size:12px;color:var(--muted)}.events{border-top:1px solid var(--line)}.entry{border-bottom:1px solid var(--line)}.entry>summary{list-style:none;display:grid;grid-template-columns:98px minmax(0,1fr) 20px;gap:12px;padding:18px 10px;border-radius:4px}.entry>summary::-webkit-details-marker{display:none}.entry>summary:after{content:'+';color:var(--muted);font-size:20px;line-height:1.1}.entry[open]>summary:after{content:'−'}.time{font:12px/1.8 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--muted)}.event-title{font-size:14px;font-weight:600;overflow-wrap:anywhere}.preview{font-size:13px;color:var(--muted);margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}.entry.good .event-title{color:var(--accent)}.entry.bad .event-title{color:var(--danger)}.event-body{margin:0 42px 22px 120px;padding:18px 20px;background:var(--surface);border:1px solid var(--line);border-radius:6px;font-size:13px;overflow-wrap:anywhere}.metadata{font-size:11px;color:var(--muted);margin-bottom:14px;overflow-wrap:anywhere}dl{margin:0}dt{font-size:11px;font-weight:600;color:var(--muted);margin:16px 0 5px;text-transform:uppercase;letter-spacing:.05em}dt:first-child{margin-top:0}dd{margin:0;white-space:pre-wrap}dd dl{padding:10px 0 0 14px;border-left:1px solid var(--line)}ul{padding-left:20px;margin:6px 0}li+li{margin-top:8px}pre{font:12px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.empty{padding:54px 20px;text-align:center;color:var(--muted);border-bottom:1px solid var(--line)}.empty strong{display:block;font-size:17px;color:var(--ink);margin-bottom:6px;font-weight:600}.empty p{max-width:55ch;margin:0 auto}.notice{background:var(--danger-bg);color:var(--danger);border:1px solid var(--line);padding:12px 16px;margin-bottom:20px;border-radius:6px;font-size:13px}[hidden]{display:none!important}.more{margin:22px auto 0;display:block}#raw{margin:30px 0;background:var(--surface);padding:16px;border:1px solid var(--line);border-radius:6px}#raw summary{font-size:13px;font-weight:600}#raw pre{margin-top:16px}footer{margin-top:28px;font-size:12px;color:var(--muted);display:flex;justify-content:space-between;gap:16px}
@media(max-width:640px){.top{padding:14px 18px}.brand span{display:none}main{padding:26px 18px 40px}.title{align-items:start}h1{font-size:26px}.goal{font-size:15px}.facts{gap:10px 24px}.toolbar{gap:14px}.field{width:100%}.live{padding:0}.entry>summary{grid-template-columns:68px minmax(0,1fr) 16px;gap:8px;padding:16px 0}.time{font-size:10px}.event-body{margin:0 0 18px;padding:14px}select{min-width:0;width:100%}footer{flex-direction:column;gap:4px}}
.recovery{background:var(--danger-bg);border:1px solid var(--line);border-radius:6px;padding:18px 20px;margin-bottom:24px;overflow-wrap:anywhere}.recovery h2{color:var(--danger);margin-bottom:12px}.recovery dd{max-width:75ch}.recovery pre{color:var(--ink)}
.outcome{display:block;font-size:13px;font-weight:600;margin-top:3px;overflow-wrap:anywhere}.entry.good .outcome{color:var(--accent)}.entry.bad .outcome{color:var(--danger)}.outcome-context{font-size:13px;color:var(--muted);margin-top:3px;white-space:pre-wrap;overflow-wrap:anywhere}
</style>
</head>
<body>
<header><div class="top"><div class="brand">ralph<span>Local progress viewer</span></div><div class="connection" id="connection" role="status"><span class="dot"></span><span id="connection-text">Connecting…</span></div></div></header>
<main>
<div class="title"><h1>Progress</h1><button id="raw-button" type="button" aria-expanded="false" aria-controls="raw">View raw log</button></div>
<p class="path" id="path">Reading progress.txt in the current directory</p>
<div class="notice" id="notice" role="alert" hidden></div>
<p class="goal" id="goal" hidden></p>
<div class="facts" aria-label="Latest activity"><div class="fact"><span>Latest phase</span><strong id="phase">Waiting</strong></div><div class="fact"><span>Iteration</span><strong id="iteration">—</strong></div><div class="fact"><span>Last event</span><strong id="latest">—</strong></div></div>
<div class="toolbar"><label class="field">Run<select id="run"><option value="">All runs</option></select></label><label class="field search">Search events<input type="search" id="search" placeholder="Find a phase, command, or decision…"></label><label class="live"><input type="checkbox" id="live" checked>Live updates</label></div>
<section class="recovery" id="recovery" aria-labelledby="recovery-heading" hidden><h2 id="recovery-heading">Run stopped · changes preserved</h2><dl id="recovery-details"></dl></section>
<div class="activity-heading"><h2>Activity</h2><span class="count" id="count" aria-live="polite">Loading…</span></div>
<div class="events" id="events"></div>
<div class="empty" id="empty"><strong id="empty-title">Loading progress</strong><p id="empty-text">Reading the latest events.</p></div>
<button class="more" id="more" type="button" hidden>Show more events</button>
<details id="raw" hidden><summary>Raw progress.txt</summary><pre id="raw-text"></pre></details>
<footer><span>Newest events first. Updates every second.</span><span id="updated">Waiting for the first update</span></footer>
</main>
<script>
'use strict';
const $ = id => document.getElementById(id);
let data = {entries:[], text:'', exists:false}, etag = '', loaded = false, limit = 100, selectedLatest = true;
const expanded = new Set();
function element(tag, text, className) { const node = document.createElement(tag); if(text !== undefined) node.textContent = text; if(className) node.className = className; return node; }
function text(value) { return typeof value === 'string' ? value : JSON.stringify(value); }
function details(value, depth = 0) {
  if (depth > 8 || value === null || typeof value !== 'object') return element('span', text(value));
  if (Array.isArray(value)) { const list = element('ul'); for (const item of value) { const row = element('li'); row.append(details(item, depth + 1)); list.append(row); } return list; }
  const list = element('dl');
  for (const [key, item] of Object.entries(value)) { list.append(element('dt', key.replaceAll(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_',' '))); const definition = element('dd'); definition.append(details(item, depth + 1)); list.append(definition); }
  return list;
}
function body(entry) { return entry.details && typeof entry.details === 'object' && !Array.isArray(entry.details) ? entry.details : {}; }
function preview(entry) { const d = body(entry); return d.command || d.error || d.summary || (d.candidate && (d.candidate.title || d.candidate)) || d.goal || d.phase || d.note || (typeof entry.details === 'string' ? entry.details : ''); }
function outcome(entry) {
  const d = body(entry);
  const recordedText = value => typeof value === 'string' && value.trim() ? value : '';
  if (entry.event === 'Host Playwright verification') {
    const labels = {passed:'Passed', failed:'Failed · Repair required', blocked:'Blocked'};
    const known = typeof d.status === 'string' && Object.hasOwn(labels, d.status);
    return {label:known ? labels[d.status] : 'Outcome not recorded', tone:d.status === 'passed' ? 'good' : d.status === 'failed' ? 'bad' : '', context:recordedText(d.reason)};
  }
  if (entry.event === 'Verification decision' || entry.event === 'Independent review decision') {
    const repair = d.nextPhase === 'repair';
    const fields = entry.event === 'Verification decision' ? [d.failures] : [d.unresolved, d.findings];
    const context = [...new Set(fields.flatMap(value => Array.isArray(value) ? value.map(recordedText).filter(Boolean) : []))].join('\n');
    const continuing = ['review', 'browser-prepare', 'browser-run', 'commit'].includes(d.nextPhase);
    return {label:repair ? 'Repair required' : continuing ? 'Repair not requested' : 'Outcome not recorded', tone:repair ? 'bad' : '', context};
  }
  return null;
}
function updateRuns() {
  const runs = [...new Set(data.entries.map(entry => entry.run))].reverse();
  const current = $('run').value;
  const desired = selectedLatest ? (data.entries.at(-1) || {}).run || '' : current;
  if (JSON.stringify(runs) !== $('run').dataset.runs) {
    $('run').replaceChildren(new Option('All runs', ''), ...runs.map(run => new Option(run, run)));
    $('run').dataset.runs = JSON.stringify(runs);
  }
  $('run').value = runs.includes(desired) ? desired : '';
}
function renderRecovery(entries) {
  const state = entries.findLast(entry => ['Run stopped; changes preserved', 'Run resumed', 'Phase started', 'Run started'].includes(entry.event));
  const stopped = state && state.event === 'Run stopped; changes preserved';
  const fields = $('recovery-details');
  fields.replaceChildren();
  $('recovery').hidden = !stopped;
  if (!stopped) return;
  const recorded = body(state);
  for (const [label, key, fallback] of [
    ['Error', 'error', 'No error recorded.'],
    ['Pending phase', 'pendingPhase', 'No pending phase recorded.'],
    ['Resume command', 'resume', 'No resume command recorded.']
  ]) {
    const value = recorded[key];
    const available = typeof value === 'string' && value.trim().length > 0;
    fields.append(element('dt', label));
    const definition = element('dd');
    definition.append(element(key === 'resume' && available ? 'pre' : 'span', available ? value : fallback));
    fields.append(definition);
  }
}
function render() {
  const focusedKey = document.activeElement && document.activeElement.tagName === 'SUMMARY' && document.activeElement.parentElement.dataset.key;
  updateRuns();
  const run = $('run').value;
  const entries = data.entries.map((entry,index) => ({...entry, key:entry.timestamp + ':' + index})).filter(entry => !run || entry.run === run);
  const summaryRun = run || (data.entries.at(-1) || {}).run;
  const summaryEntries = data.entries.filter(entry => entry.run === summaryRun);
  renderRecovery(summaryEntries);
  const latestPhase = summaryEntries.findLast(entry => entry.event === 'Phase started');
  const latest = summaryEntries.at(-1);
  const start = summaryEntries.find(entry => entry.event === 'Run started');
  const goal = start ? body(start).goal : '';
  $('goal').textContent = typeof goal === 'string' ? goal : '';
  $('goal').hidden = !goal;
  $('phase').textContent = latest && latest.event.startsWith('Run stopped') ? 'Stopped · ' + (body(latest).pendingPhase || 'unknown phase') : latestPhase ? body(latestPhase).phase || 'Unknown' : 'Waiting';
  const iteration = latestPhase && body(latestPhase).iteration;
  const total = start && body(start).iterations;
  $('iteration').textContent = iteration ? String(iteration) + (total ? ' / ' + total : total === 0 ? ' / unlimited' : '') : '—';
  $('latest').textContent = latest ? latest.event : '—';
  const query = $('search').value.toLowerCase();
  const filtered = entries.filter(entry => JSON.stringify(entry).toLowerCase().includes(query)).reverse();
  const visible = filtered.slice(0, limit);
  const fragment = document.createDocumentFragment();
  for (const entry of visible) {
    const row = element('details', undefined, 'entry');
    row.dataset.key = entry.key;
    const result = outcome(entry);
    if (result) { if (result.tone) row.classList.add(result.tone); }
    else if (/failed|stopped/i.test(entry.event)) row.classList.add('bad');
    else if (/passed|approved/i.test(entry.event)) row.classList.add('good');
    row.open = expanded.has(entry.key);
    const summary = element('summary');
    const date = new Date(entry.timestamp);
    const time = element('time', isNaN(date.getTime()) ? entry.timestamp : date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}), 'time');
    time.dateTime = entry.timestamp; time.title = entry.timestamp;
    const info = element('div'); info.append(element('div', entry.event, 'event-title'));
    if (result) {
      info.append(element('div', result.label, 'outcome'));
      if (result.context) info.append(element('div', result.context, 'outcome-context'));
    } else {
      const context = preview(entry); if(context) info.append(element('div', String(context), 'preview'));
    }
    summary.append(time, info);
    const content = element('div', undefined, 'event-body');
    content.append(element('div', entry.timestamp + ' · ' + entry.run, 'metadata'), details(entry.details));
    row.append(summary, content);
    row.addEventListener('toggle', () => { if(row.open) expanded.add(entry.key); else expanded.delete(entry.key); });
    fragment.append(row);
  }
  $('events').replaceChildren(fragment);
  if (focusedKey) { const row = [...$('events').children].find(row => row.dataset.key === focusedKey); if(row) row.querySelector('summary').focus({preventScroll:true}); }
  $('count').textContent = filtered.length ? visible.length + ' of ' + filtered.length + ' events' : '0 events';
  $('more').hidden = filtered.length <= limit;
  $('empty').hidden = filtered.length > 0;
  let title = 'No matching events', message = 'Try another search or choose a different run.';
  if (!data.exists) { title = 'Waiting for progress.txt'; message = 'Start a Ralph run in this directory. Events will appear here as they are written.'; }
  else if (!data.text.trim()) { title = 'No events yet'; message = 'progress.txt is empty. New activity will appear automatically.'; }
  else if (!data.entries.length) { title = 'Plain text log'; message = 'This file has no structured Ralph events. Open the raw log to read it live.'; }
  $('empty-title').textContent = title; $('empty-text').textContent = message;
  $('raw-text').textContent = data.text || (data.exists ? 'The file is empty.' : 'progress.txt has not been created yet.');
}
async function refresh() {
  if (!$('live').checked && loaded) { $('connection-text').textContent = 'Updates paused'; setTimeout(refresh, 1000); return; }
  try {
    const response = await fetch('/api/progress', {headers:etag ? {'If-None-Match':etag} : {}, signal:AbortSignal.timeout(5000)});
    if(response.status !== 304) {
      const payload = await response.json();
      if(!response.ok) throw new Error(payload.error || 'Could not read progress.txt.');
      data = payload; etag = response.headers.get('etag') || ''; loaded = true;
      $('path').textContent = data.file;
      render();
    }
    $('notice').hidden = true; $('connection').classList.remove('offline');
    $('connection-text').textContent = 'Live';
    $('updated').textContent = 'Checked ' + new Date().toLocaleTimeString();
  } catch(error) {
    $('connection').classList.add('offline'); $('connection-text').textContent = 'Reconnecting';
    $('notice').textContent = error.message + ' Retrying automatically. Previously loaded events are preserved.'; $('notice').hidden = false;
    if(!loaded) { $('empty-title').textContent = 'Waiting for the server'; $('empty-text').textContent = 'The page will reconnect automatically.'; }
  }
  setTimeout(refresh, 1000);
}
$('run').addEventListener('change', () => { selectedLatest = false; limit = 100; render(); });
$('search').addEventListener('input', () => { limit = 100; render(); });
$('more').addEventListener('click', () => { limit += 100; render(); });
$('live').addEventListener('change', () => { $('connection-text').textContent = $('live').checked ? 'Connecting…' : 'Updates paused'; });
$('raw-button').addEventListener('click', () => { const show = $('raw').hidden; $('raw').hidden = !show; $('raw').open = show; $('raw-button').setAttribute('aria-expanded', String(show)); $('raw-button').textContent = show ? 'Hide raw log' : 'View raw log'; if(show) $('raw').scrollIntoView({behavior:'instant',block:'start'}); });
refresh();
</script>
</body>
</html>`;
