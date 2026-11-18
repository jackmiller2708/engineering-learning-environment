// Prototype renderer. Query: ?screen=worlds|lab &state=<name> &theme=light|dark
// All lab names, times and ids below are SYNTHETIC test data (the same set used in the Task 3.9 audit).
const q = new URLSearchParams(location.search);
const screen = q.get('screen') || 'worlds', state = q.get('state') || 'default', theme = q.get('theme') || 'dark';
document.documentElement.dataset.theme = theme;
if (q.get('dir')) document.documentElement.dataset.dir = q.get('dir');
if (q.get('fh')) document.documentElement.style.setProperty('--frame-h', q.get('fh') + 'px');
if (q.get('fw')) document.documentElement.style.setProperty('--frame-w', q.get('fw') + 'px');

const ICON_NO = '<svg class="ico" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.2 10.8 10.8 3.2" stroke="currentColor" stroke-width="1.5"/></svg>';
const CARET = '<svg class="caret" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
const TICK = '<svg class="tick" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5 5 9.5 10 3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

const LABS = [
  { id: '497cb045-737e-4cea-91d8-458d4c319ab7', name: 'Adder bench', created: '2026-11-17T11:21:00Z' },
  { id: 'd7a94890-9f7e-4b91-ac10-577f25b1625a', name: 'Adder bench', created: '2026-11-17T11:17:00Z' },
  { id: '2155b3f7-c062-4e3b-b2df-82adeb733172', name: 'Scratch', created: '2026-11-16T21:40:00Z' },
];
const BAD = [
  { id: '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b', kind: 'manifest_malformed' },
  { id: '9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d', kind: 'manifest_missing' },
];
// Learner-facing copy. Mirrors DESIGN_SPEC section 10 (keyed by host error kind). The host `message` is never shown.
const RETRY = 'Try again.';
const COPY = {
  listFailed: 'The application could not read your labs. ' + RETRY,
  createSaveFailed: 'The lab could not be saved. No lab was created. Try again.',
  createUnconfirmed: 'Something went wrong inside the application, and it cannot confirm whether the lab was created. Check the list below before trying again.',
  tooLong: 'The name is longer than 64 characters. Use a shorter name.',
};
const REASON = {
  manifest_malformed: 'The information saved for this lab cannot be read or is not valid.',
  manifest_missing: 'This lab is missing information the application needs to open it.',
  manifest_unsupported_version: 'This lab was saved in a form this version of the application cannot open.',
  entry_unreadable: 'This lab could not be read.',
};
const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' });
const local = (iso) => fmt.format(new Date(iso)).replace(' at ', ', ');
const utc = (iso) => iso.replace('T', ' ').replace(/:\d\dZ$/, ' UTC');
const sid = (id) => id.slice(0, 8);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function bar(kind, labName, labId, menu) {
  const brand = '<a class="brand" href="#">Engineering Learning Environment</a>';
  let crumbs;
  if (kind === 'worlds') crumbs = '<li><span class="crumb" aria-current="page"><span class="t">Worlds</span></span></li>';
  else crumbs = `<li><a class="crumb" href="#"><span class="t">Worlds</span></a></li><li><span class="sep" aria-hidden="true">/</span></li>
    <li data-slot="world"><span class="crumb crumb-static"><span class="t">Computer Foundations</span></span></li>
    ${labName ? `<li><span class="sep" aria-hidden="true">/</span></li><li><span class="crumb" aria-current="page"><span class="t" dir="auto">${esc(labName)}</span><span class="id mono">${sid(labId)}</span></span></li>` : ''}`;
  const m = '';
  return `<header class="bar">${brand}<nav class="crumbs" aria-label="You are here"><ol>${crumbs}</ol></nav>${m}</header>`;
}

function labRows(opts = {}) {
  const long = opts.long;
  let labs = LABS.map((l) => ({ ...l }));
  if (long) labs = [{ id: LABS[0].id, name: 'W'.repeat(64), created: LABS[0].created }, { id: LABS[1].id, name: 'مختبر ثنائي 二進数 — ' + 'x'.repeat(40), created: LABS[1].created }, { id: LABS[2].id, name: 'A lab named with a very long ordinary sentence so that it has to wrap across more than one line in a narrow list', created: LABS[2].created }];
  const created = opts.created;
  const rows = labs.map((l, i) => `<li><a class="row" href="#" ${i === 0 && opts.focus ? 'id="f"' : ''}>
      <span class="nm" dir="auto" title="${esc(l.name)}">${created && i === 0 ? '<span class="tag">New</span>' : ''}${esc(l.name)}</span>
      <time class="when" datetime="${l.created}" title="${utc(l.created)}">${local(l.created)}</time>
      <span class="idc mono">${sid(l.id)}</span><span class="open" aria-hidden="true">Open lab</span></a></li>`).join('');
  const head = '<li class="row head" aria-hidden="true"><span>Name</span><span>Created (GMT+7)</span><span>ID</span><span></span></li>';
  const bad = `<p class="grouphead" id="bh">Cannot be opened</p><p class="grouphelp">The application cannot repair or remove these labs.</p><ul class="labs" aria-labelledby="bh">${BAD.map((b) => `<li class="bad"><span class="nm">${ICON_NO}Cannot be opened</span><span class="idc mono">${sid(b.id)}</span><span class="why">${REASON[b.kind]}</span></li>`).join('')}</ul>`;
  return `<ul class="labs">${head}${rows}</ul>${opts.noBad ? '' : bad}`;
}

function createForm(s) {
  const v = s.value || '', invalid = !!s.error;
  return `<section class="create" aria-labelledby="ch"><h2 id="ch">Create new lab</h2>
    <form><div class="field"><div class="grow"><label for="nm">Name</label>
    <input id="nm" type="text" autocomplete="off" spellcheck="false" value="${esc(v)}" ${invalid ? 'aria-invalid="true" aria-describedby="e h"' : 'aria-describedby="h"'}>
    ${invalid ? `<p class="err" id="e" role="alert">${s.error}</p>` : ''}
    <p class="hint" id="h">Up to 64 characters.</p></div>
    <button class="btn primary" type="button">Create new lab</button></div></form>
    <div class="status" role="status">${s.created ? `<p class="ok"><span>Created \u201c${esc(s.created)}\u201d.</span><a href="#">Open lab</a></p>` : ''}</div></section>`;
}

function rail() {
  return `<nav class="rail" aria-label="Worlds"><h2>Worlds</h2><a href="#" aria-current="page">Computer Foundations</a></nav>`;
}

function worlds() {
  let list = '', form = createForm({}), extra = '';
  const head = `<h1 id="t" tabindex="-1">Computer Foundations</h1>`; // no description line: removed by owner decision (Task 3.16)
  const labsHead = (n) => `<h2 class="sec">Labs${n != null ? `<span class="n">${n} ${n === 1 ? 'lab' : 'labs'}</span>` : ''}</h2>`;
  switch (state) {
    case 'default': list = labsHead(3) + labRows(); break;
    case 'focus': list = labsHead(3) + labRows({ focus: true }); break;
    case 'empty': list = labsHead(0) + `<div class="empty"><p>You have no labs in this world yet.</p><p>Create one to start. It is saved on this computer.</p></div>`; break;
    case 'loading': list = labsHead() + `<p class="loading" role="status">Loading labs…</p>`; break;
    case 'error': list = labsHead() + `<div class="problem" role="alert"><p><strong>Your labs could not be loaded.</strong></p><p>${COPY.listFailed}</p><button class="btn" type="button">Try again</button></div>`; form = createForm({}); break;
    case 'validation': list = labsHead(3) + labRows(); form = createForm({ value: 'A lab name that is considerably longer than the sixty-four characters allowed', error: COPY.tooLong }); break;
    case 'created': list = labsHead(3) + labRows({ created: true }); form = createForm({ created: 'Adder bench' }); break;
    case 'recovery': extra = `<div class="notice" role="status"><strong>Your last lab (<span class="mono">3f2b8c1e</span>) cannot be opened.</strong><p>${REASON.manifest_malformed} It is listed below under Cannot be opened, and Worlds is open instead.</p></div>`; list = labsHead(3) + labRows(); break;
    case 'recovery-missing': extra = `<div class="notice" role="status"><strong>Your last lab is no longer available.</strong><p>It is not in your list of labs, so Worlds is open instead.</p></div>`; list = labsHead(3) + labRows({ noBad: true }); break;
    case 'recovery-transient': list = labsHead() + `<div class="problem" role="alert"><p><strong>Your labs couldn't be checked.</strong></p><p>${COPY.listFailed}</p><button class="btn" type="button">Try again</button></div>`; break;
    case 'createfail': list = labsHead(3) + labRows(); form = createForm({ value: 'Adder bench', error: COPY.createSaveFailed }); break;
    case 'createunsure': list = labsHead(3) + labRows(); form = createForm({ value: 'Adder bench', error: COPY.createUnconfirmed }); break;
    case 'longnames': list = labsHead(3) + labRows({ long: true, noBad: true }); break;
  }
  const body = `${form}${list}`;
  return bar('worlds', null, null, state === 'menu') + `<div class="worlds">${rail()}<main class="main" aria-labelledby="t">${head}${extra}${body}</main></div>`;
}

function lab() {
  const L = LABS[0];
  const full = `<dl class="tb"><div><dt>World</dt><dd>Computer Foundations</dd></div><div><dt>Lab</dt><dd class="nm2" dir="auto">${esc(L.name)}</dd></div><div><dt>Created</dt><dd><time datetime="${L.created}">${local(L.created)} (GMT+7)</time><br><span class="mono">${utc(L.created)}</span></dd></div><div><dt>ID</dt><dd class="mono">${L.id}</dd></div></dl>`;
  if (state === 'opening') return bar('lab', null, null, false) + `<main class="fullpage" aria-busy="true"><p class="loading" role="status">Opening your last lab…</p></main>`;
  if (state === 'failed') return bar('lab', null, null, false) + `<main class="fullpage"><h1 id="t" tabindex="-1">This lab could not be loaded</h1><div class="problem" role="alert"><p>${COPY.listFailed} Until it can, the application cannot tell whether this lab exists.</p><button class="btn" type="button">Try again</button></div><p style="margin-top:16px"><a href="#">Go to Worlds</a></p></main>`;
  if (state === 'badaddress') return bar('lab', null, null, false) + `<main class="fullpage"><h1 id="t" tabindex="-1">Not a lab address</h1><p>This address does not point to a lab.</p><p><a href="#">Go to Worlds</a></p></main>`;
  if (state === 'unopenable') return bar('lab', null, null, false) + `<main class="fullpage"><h1 id="t" tabindex="-1">This lab cannot be opened</h1><p>${REASON.manifest_unsupported_version}</p><p>The application cannot repair or remove it.</p><p><a href="#">Go to Worlds</a></p></main>`;
  if (state === 'notfound') return bar('lab', null, null, false) + `<main class="fullpage"><h1 id="t" tabindex="-1">Lab not found</h1><p>This lab is not in your list of labs.</p><p><a href="#">Go to Worlds</a></p></main>`;
  const map = state === 'map' ? `<div class="ghost" style="left:0;top:0;bottom:0;width:224px;border-left:0;border-top:0;border-bottom:0">Library<small>primitives, built components, supplied examples</small></div>
    <div class="ghost" style="right:0;top:0;bottom:36px;width:280px;border-right:0;border-top:0">Inspector<small>inspect · reference (tabs)</small></div>
    <div class="ghost" style="left:224px;right:280px;bottom:0;height:36px;border-bottom:0">Investigation<small style="display:inline;margin-left:8px">collapsed strip by default; opens upward</small></div>
    <div class="ghost" style="left:224px;right:280px;top:0;bottom:36px;border:0;background:none;color:var(--muted);display:grid;place-items:center">Bench</div>
    <div class="diag">Design diagram — regions are not built in this stage</div>` : '';
  const note = state === 'map' ? '' : `<div class="bench-note"><strong>The bench is not available yet.</strong><span>This lab is saved on this computer. Nothing has been added to it.</span></div>`;
  return bar('lab', L.name, L.id, state === 'menu') + `<div class="lab"><div class="labbar"><h1 id="t" tabindex="-1" dir="auto" title="${esc(L.name)}">${esc(L.name)}</h1><span class="meta">Created ${local(L.created)}</span></div>
    <section class="benchwrap" aria-label="Bench">${note}${state === 'map' ? '' : full}${map}</section></div>`;
}

document.getElementById('app').innerHTML = screen === 'lab' ? lab() : worlds();
if (state === 'focus') document.getElementById('f')?.focus();

if (q.get('scroll') === 'end') { const m = document.querySelector('.main') || document.querySelector('.fullpage'); if (m) m.scrollTop = m.scrollHeight; }
