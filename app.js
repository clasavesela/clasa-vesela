import { isConfigured, normCode, getClass, listStudents, getStudent, submitSheet } from './cloud.js';
import { makeComperTest, gradeLabel, isGrade, TIER_POINTS, TIER_NAMES } from './comper.js';
import { ask } from './ui.js';

// ================== Setări ==================
const STORAGE_KEY = 'matematica-vesela-v1';
const SHEET_SIZE = 10;          // câte exerciții are o fișă
const POINTS_PER_CORRECT = 10;  // puncte pe răspuns corect (înmulțit cu nivelul)
const PERFECT_BONUS = 50;       // bonus pentru fișă fără greșeli

const LEVELS = {
  1: { label: 'până la 20', max: 20 },
  2: { label: 'până la 100', max: 100 },
  3: { label: 'până la 1000', max: 1000 }
};

const RANKS = [
  { min: 0, name: 'Începător', icon: '🌱' },
  { min: 200, name: 'Ucenic', icon: '📘' },
  { min: 500, name: 'Isteț', icon: '💡' },
  { min: 1000, name: 'Campion', icon: '🏆' },
  { min: 2000, name: 'Maestru', icon: '🎓' },
  { min: 4000, name: 'Geniu al matematicii', icon: '🚀' },
  { min: 8000, name: 'Legendă', icon: '👑' }
];

const PRAISE = ['Bravo!', 'Super!', 'Excelent!', 'Ești grozav!', 'Minunat!', 'Felicitări!'];

// ================== Stocare locală ==================
// Pe dispozitiv păstrăm doar clasa și elevul ales (accesul se face numai cu cod de clasă).
function load() {
  let s = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) s = JSON.parse(raw);
  } catch (e) { /* stocare indisponibilă */ }
  return { cls: (s && s.cls) || null };
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignorăm */ }
}

const state = load();
save(); // șterge eventualele profiluri vechi „exersez singur”
let remote = null; // elevul din clasă, cu datele venite din Firebase

// ================== Utilitare ==================
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function inClass() {
  return isConfigured && !!state.cls;
}

function currentProfile() {
  return inClass() ? remote : null;
}

function normalizeStudent(s) {
  return {
    id: s.id,
    name: s.name,
    avatar: s.avatar || '🙂',
    points: s.points || 0,
    sheets: s.sheets || 0,
    perfect: s.perfect || 0,
    correct: s.correct || 0,
    answered: s.answered || 0,
    history: Array.isArray(s.recent) ? s.recent : []
  };
}

function rankInfo(points) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (points >= RANKS[i].min) idx = i;
  return { rank: RANKS[idx], next: RANKS[idx + 1] || null, index: idx };
}

function showScreen(id) {
  $all('.screen').forEach((s) => { s.hidden = s.id !== id; });
  window.scrollTo(0, 0);
  renderHeader();
}

// ================== Generare exerciții ==================
function digits(n) {
  return [n % 10, Math.floor(n / 10) % 10, Math.floor(n / 100) % 10, Math.floor(n / 1000) % 10];
}

// adunare cu trecere peste ordin: pe cel puțin o coloană cifrele adunate fac 10 sau mai mult
function hasCarry(a, b) {
  const x = digits(a), y = digits(b);
  for (let i = 0; i < 4; i++) if (x[i] + y[i] >= 10) return true;
  return false;
}

// scădere cu împrumut: pe cel puțin o coloană cifra de sus e mai mică decât cea de jos
function hasBorrow(a, b) {
  const x = digits(a), y = digits(b);
  for (let i = 0; i < 4; i++) if (x[i] < y[i]) return true;
  return false;
}

function genAdd(level, carry) {
  const M = LEVELS[level].max;
  let a, b;
  for (let t = 0; t < 5000; t++) {
    a = rand(level === 1 ? 1 : Math.floor(M / 10), M - 1);
    b = rand(1, M - a);
    if (hasCarry(a, b) === carry) break;
  }
  return { a, b, op: '+', r: a + b };
}

function genSub(level, borrow) {
  const M = LEVELS[level].max;
  let a, b;
  for (let t = 0; t < 5000; t++) {
    a = rand(level === 1 ? 2 : Math.floor(M / 10), M);
    b = rand(1, a - 1);
    if (hasBorrow(a, b) === borrow) break;
  }
  return { a, b, op: '−', r: a - b };
}

function genMul(table) {
  const t = table === 'all' ? rand(2, 10) : table;
  const f = rand(0, 10);
  return Math.random() < 0.5
    ? { a: t, b: f, op: '×', r: t * f }
    : { a: f, b: t, op: '×', r: t * f };
}

// Alege ce căsuță rămâne goală: de obicei rezultatul, uneori un termen / factor.
function chooseHidden(item, type, level) {
  const chance = type === 'mul' ? 0.2 : (level === 1 ? 0.15 : 0.25);
  if (Math.random() >= chance) return 'r';
  // la înmulțire, factorul lipsă trebuie să aibă un singur răspuns posibil
  if (type === 'mul' && (item.a === 0 || item.b === 0)) return 'r';
  return Math.random() < 0.5 ? 'a' : 'b';
}

function generateSheet(cfg) {
  const items = [];
  const seen = {};
  let tries = 0;
  while (items.length < SHEET_SIZE && tries < 500) {
    tries++;
    const it = cfg.type === 'add' ? genAdd(cfg.level, cfg.carry)
      : cfg.type === 'sub' ? genSub(cfg.level, cfg.carry)
      : genMul(cfg.table);
    it.hide = chooseHidden(it, cfg.type, cfg.level);
    const key = it.a + it.op + it.b;
    if (seen[key] && tries < 400) continue;
    seen[key] = true;
    items.push(it);
  }
  return items;
}

function configLabel(cfg) {
  if (cfg.type === 'comper') return 'Comper · ' + gradeLabel(cfg.grade);
  if (cfg.type === 'add') {
    return 'Adunări ' + (cfg.carry ? 'cu' : 'fără') + ' trecere peste ordin, ' + LEVELS[cfg.level].label;
  }
  if (cfg.type === 'sub') {
    return 'Scăderi ' + (cfg.carry ? 'cu' : 'fără') + ' împrumut, ' + LEVELS[cfg.level].label;
  }
  return cfg.table === 'all' ? 'Tabla înmulțirii – amestecat' : 'Tabla înmulțirii cu ' + cfg.table;
}

// cod scurt al categoriei, folosit de profesor pentru statistici (ex: add-cu-100, mul-7)
function configType(cfg) {
  if (cfg.type === 'comper') return 'comper-' + cfg.grade;
  if (cfg.type === 'mul') return 'mul-' + cfg.table;
  return cfg.type + '-' + (cfg.carry ? 'cu' : 'fara') + '-' + LEVELS[cfg.level].max;
}

// „cu trecere / cu împrumut” valorează un nivel în plus
function multiplier(cfg) {
  if (cfg.type === 'mul') return cfg.table === 'all' ? 2 : 1;
  return cfg.level + (cfg.carry ? 1 : 0);
}

function itemText(it) {
  const v = (k) => (k === it.hide ? '?' : it[k]);
  return v('a') + ' ' + it.op + ' ' + v('b') + ' = ' + v('r');
}

// ================== Header ==================
function renderHeader() {
  const p = currentProfile();
  const onStart = !$('#screen-profiles').hidden || !$('#screen-class').hidden || !$('#screen-loading').hidden;
  $('#who').hidden = !p || onStart;
  if (!p) return;
  $('#who-avatar').textContent = p.avatar;
  $('#who-name').textContent = p.name;
  $('#who-points').textContent = p.points;
}

function bumpPoints() {
  const el = $('.who-points');
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

// ================== Ecran de intrare (cod de clasă) ==================
function openProfiles() {
  $('#class-error').hidden = true;
  if (state.cls && !$('#class-code').value) $('#class-code').value = state.cls.code;
  showScreen('screen-profiles');
}

// ================== Clasa online ==================
function showClassError(msg) {
  const err = $('#class-error');
  err.textContent = msg;
  err.hidden = false;
}

function setupClassCard() {
  if (!isConfigured) {
    $('#class-off').hidden = false;
    $('#class-code').disabled = true;
    $('#class-go').disabled = true;
  }
}

$('#class-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = normCode($('#class-code').value);
  if (!code) { showClassError('Scrie codul clasei.'); return; }
  openClassPicker(code);
});

$('#class-code').addEventListener('input', (e) => {
  const v = normCode(e.target.value);
  if (v !== e.target.value) e.target.value = v;
});

async function openClassPicker(code) {
  const btn = $('#class-go');
  btn.disabled = true;
  btn.textContent = 'Caut…';
  $('#class-error').hidden = true;
  try {
    const cls = await getClass(code);
    if (!cls) {
      if ($('#screen-profiles').hidden) openProfiles();
      showClassError('Nu am găsit nicio clasă cu codul „' + code + '”. Verifică literele.');
      return;
    }
    const students = await listStudents(code);
    renderClassPicker(cls, students);
    showScreen('screen-class');
  } catch (e) {
    console.error(e);
    if ($('#screen-profiles').hidden) openProfiles();
    showClassError('Nu m-am putut conecta. Verifică internetul și încearcă din nou.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Intră';
  }
}

function renderClassPicker(cls, students) {
  $('#class-title').textContent = cls.name;
  const grid = $('#student-grid');
  grid.innerHTML = '';
  $('#no-students').hidden = students.length > 0;
  students.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'student-btn';
    const av = document.createElement('span'); av.className = 'avatar'; av.textContent = s.avatar || '🙂';
    const nm = document.createElement('span'); nm.className = 'sname'; nm.textContent = s.name;
    b.append(av, nm);
    b.addEventListener('click', () => {
      state.cls = { code: cls.code, sid: s.id, className: cls.name, grade: cls.grade };
      save();
      remote = normalizeStudent(s);
      openMenu();
    });
    grid.appendChild(b);
  });
}

$('#class-back').addEventListener('click', openProfiles);

// ================== Meniu ==================
function renderTableChoices() {
  const box = $('#table-choices');
  for (let t = 1; t <= 10; t++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn choice';
    b.dataset.type = 'mul';
    b.dataset.table = String(t);
    b.textContent = '× ' + t;
    box.appendChild(b);
  }
}

function openMenu() {
  const p = currentProfile();
  if (!p) { openProfiles(); return; }

  $('#greeting').textContent = 'Bună, ' + p.name + '! ' + p.avatar;
  const cl = $('#class-line');
  if (inClass()) {
    cl.textContent = '🏫 ' + state.cls.className + ' · fișele tale ajung la profesor';
    cl.hidden = false;
  } else {
    cl.hidden = true;
  }

  renderComperCard();

  const ri = rankInfo(p.points);
  $('#rank-icon').textContent = ri.rank.icon;
  $('#rank-name').textContent = ri.rank.name;
  if (ri.next) {
    const span = ri.next.min - ri.rank.min;
    const done = p.points - ri.rank.min;
    $('#rank-next').textContent = 'Mai ai ' + (ri.next.min - p.points) + ' puncte până la „' + ri.next.name + '” ' + ri.next.icon;
    $('#rank-bar').style.width = Math.min(100, Math.round(done / span * 100)) + '%';
  } else {
    $('#rank-next').textContent = 'Ai ajuns la cel mai înalt nivel! 🎉';
    $('#rank-bar').style.width = '100%';
  }

  $('#st-points').textContent = p.points;
  $('#st-sheets').textContent = p.sheets;
  $('#st-percent').textContent = p.answered ? Math.round(p.correct / p.answered * 100) + '%' : '–';
  $('#st-perfect').textContent = p.perfect;

  const hist = $('#history');
  hist.innerHTML = '';
  $('#no-history').hidden = p.history.length > 0;
  p.history.slice(0, 8).forEach((h) => {
    const li = document.createElement('li');
    const left = document.createElement('span');
    const d = new Date(h.date);
    left.textContent = d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' }) + ' · ' + h.label + ' · ' + h.correct + '/' + h.total;
    const right = document.createElement('span');
    right.className = 'h-pts';
    right.textContent = '+' + h.points + ' ⭐';
    li.append(left, right);
    hist.appendChild(li);
  });

  showScreen('screen-menu');
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.choice[data-type]');
  if (!btn) return;
  const cfg = { type: btn.dataset.type };
  if (cfg.type === 'mul') {
    cfg.table = btn.dataset.table === 'all' ? 'all' : parseInt(btn.dataset.table, 10);
  } else {
    cfg.level = parseInt(btn.dataset.level, 10);
    cfg.carry = btn.dataset.carry === '1';
  }
  startSheet(cfg);
});

// ================== Comper ==================
function classGrade() {
  return state.cls && isGrade(state.cls.grade) ? state.cls.grade : null;
}

function renderComperCard() {
  const g = classGrade();
  $('#comper-grade').textContent = g === null ? '' : ' · ' + gradeLabel(g);
  $('#comper-start').hidden = g === null;
  $('#comper-off').hidden = g !== null;
}

$('#comper-start').addEventListener('click', () => {
  const g = classGrade();
  if (g !== null) startSheet({ type: 'comper', grade: g });
});

function startComper(cfg) {
  sheet = { cfg, items: makeComperTest(cfg.grade), checked: false, warned: false, picks: [] };
  $('#sheet-title').textContent = configLabel(cfg);
  $('#sheet-hint').textContent = 'Alege câte un răspuns la fiecare întrebare, apoi apasă „Verifică”.';
  $('#sheet-msg').hidden = true;
  $('#result').hidden = true;
  $('#check-wrap').hidden = false;
  $('#sheet-hint').hidden = false;

  const box = $('#sheet');
  box.innerHTML = '';
  box.classList.add('comper');
  let lastTier = 0;
  sheet.items.forEach((it, idx) => {
    if (it.tier !== lastTier) {
      lastTier = it.tier;
      const h = document.createElement('h2');
      h.className = 'cq-part';
      h.textContent = TIER_NAMES[it.tier] + ' · ' + TIER_POINTS[it.tier] + ' puncte / răspuns corect';
      box.appendChild(h);
    }
    const card = document.createElement('div');
    card.className = 'cq';
    card.dataset.idx = String(idx);

    const head = document.createElement('p');
    head.className = 'cq-text';
    const no = document.createElement('b');
    no.textContent = (idx + 1) + '. ';
    head.append(no, document.createTextNode(it.text));

    const opts = document.createElement('div');
    opts.className = 'cq-opts';
    it.options.forEach((o, oi) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cq-opt';
      b.dataset.q = String(idx);
      b.dataset.o = String(oi);
      b.setAttribute('aria-pressed', 'false');
      const letter = document.createElement('span');
      letter.className = 'cq-letter';
      letter.textContent = 'ABCD'[oi];
      const txt = document.createElement('span');
      txt.textContent = o;
      b.append(letter, txt);
      opts.appendChild(b);
    });

    const fb = document.createElement('p');
    fb.className = 'cq-fb';
    fb.hidden = true;

    card.append(head, opts, fb);
    box.appendChild(card);
  });

  showScreen('screen-exercise');
}

$('#sheet').addEventListener('click', (e) => {
  const b = e.target.closest('.cq-opt');
  if (!b || !sheet || sheet.checked) return;
  const q = parseInt(b.dataset.q, 10);
  sheet.picks[q] = parseInt(b.dataset.o, 10);
  b.closest('.cq').classList.remove('empty');
  b.parentElement.querySelectorAll('.cq-opt').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
});

function checkComper() {
  const cards = $all('#sheet .cq');
  const empty = cards.filter((c) => sheet.picks[parseInt(c.dataset.idx, 10)] === undefined);
  if (empty.length && !sheet.warned) {
    sheet.warned = true;
    empty.forEach((c) => c.classList.add('empty'));
    showMsg(empty.length === 1
      ? 'Nu ai ales răspunsul la o întrebare. Alege-l sau apasă din nou „Verifică”.'
      : 'Nu ai ales răspunsul la ' + empty.length + ' întrebări. Alege-le sau apasă din nou „Verifică”.');
    empty[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    return null;
  }

  sheet.checked = true;
  let correct = 0, pts = 0;
  const items = [];
  cards.forEach((card) => {
    const idx = parseInt(card.dataset.idx, 10);
    const it = sheet.items[idx];
    const pi = sheet.picks[idx];
    const given = pi === undefined ? '' : it.options[pi];
    const ok = given === it.answer;
    card.classList.remove('empty');
    card.classList.add(ok ? 'ok' : 'bad');
    card.querySelectorAll('.cq-opt').forEach((b) => {
      b.disabled = true;
      const o = it.options[parseInt(b.dataset.o, 10)];
      if (o === it.answer) b.classList.add('right');
      else if (o === given) b.classList.add('wrong');
    });
    const fb = card.querySelector('.cq-fb');
    fb.textContent = (ok ? '✓ Corect! ' : (given === '' ? '✗ Fără răspuns. ' : '✗ ') + 'Răspunsul corect: ' + it.answer + '. ') + (it.explain || '');
    fb.hidden = false;
    if (ok) { correct++; pts += TIER_POINTS[it.tier]; }
    items.push({ q: it.text, given, answer: it.answer, ok });
  });
  return { correct, pts, items };
}

// ================== Fișa de exerciții ==================
let sheet = null; // { cfg, items, checked, warned }

function startSheet(cfg) {
  if (cfg.type === 'comper') { startComper(cfg); return; }
  $('#sheet').classList.remove('comper');
  $('#sheet-hint').innerHTML = 'Completează căsuțele goale, apoi apasă <b>Verifică</b>.';
  sheet = { cfg, items: generateSheet(cfg), checked: false, warned: false };
  $('#sheet-title').textContent = configLabel(cfg);
  $('#sheet-msg').hidden = true;
  $('#result').hidden = true;
  $('#check-wrap').hidden = false;
  $('#sheet-hint').hidden = false;

  const box = $('#sheet');
  box.innerHTML = '';
  sheet.items.forEach((it, idx) => {
    const card = document.createElement('div');
    card.className = 'ex';

    const no = document.createElement('span');
    no.className = 'ex-no';
    no.textContent = (idx + 1) + '.';

    const body = document.createElement('span');
    body.className = 'ex-body';
    body.append(part(it, 'a', idx), opSpan(it.op), part(it, 'b', idx), opSpan('='), part(it, 'r', idx));

    const mark = document.createElement('span');
    mark.className = 'mark';

    card.append(no, body, mark);
    box.appendChild(card);
  });

  showScreen('screen-exercise');
  const first = $('#sheet .ans');
  if (first) first.focus();
}

function opSpan(txt) {
  const s = document.createElement('span');
  s.className = 'op';
  s.textContent = txt;
  return s;
}

function part(it, key, idx) {
  if (key !== it.hide) {
    const s = document.createElement('span');
    s.className = 'num';
    s.textContent = it[key];
    return s;
  }
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'ans';
  inp.inputMode = 'numeric';
  inp.autocomplete = 'off';
  inp.maxLength = 4;
  inp.dataset.idx = String(idx);
  inp.setAttribute('aria-label', 'Răspuns la exercițiul ' + (idx + 1));
  return inp;
}

// doar cifre în căsuțe
$('#sheet').addEventListener('input', (e) => {
  if (!e.target.classList.contains('ans')) return;
  const clean = e.target.value.replace(/\D/g, '');
  if (clean !== e.target.value) e.target.value = clean;
  if (clean) e.target.classList.remove('empty');
});

// Enter = treci la următorul exercițiu
$('#sheet').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target.classList.contains('ans')) return;
  e.preventDefault();
  const inputs = $all('#sheet .ans');
  const i = inputs.indexOf(e.target);
  const next = inputs.slice(i + 1).concat(inputs.slice(0, i)).find((x) => !x.value);
  if (next) next.focus();
  else $('#check-btn').focus();
});

function showMsg(text) {
  const m = $('#sheet-msg');
  m.textContent = text;
  m.hidden = false;
}

$('#check-btn').addEventListener('click', checkSheet);

// Verifică fișa cu căsuțe (adunări, scăderi, înmulțiri).
function checkNumbers() {
  const inputs = $all('#sheet .ans');
  const empty = inputs.filter((i) => i.value.trim() === '');

  if (empty.length && !sheet.warned) {
    sheet.warned = true;
    empty.forEach((i) => i.classList.add('empty'));
    showMsg(empty.length === 1
      ? 'Ai lăsat un exercițiu necompletat. Completează-l sau apasă din nou „Verifică”.'
      : 'Ai lăsat ' + empty.length + ' exerciții necompletate. Completează-le sau apasă din nou „Verifică”.');
    empty[0].focus();
    return null;
  }

  sheet.checked = true;
  let correct = 0;
  const items = [];
  inputs.forEach((inp) => {
    const it = sheet.items[parseInt(inp.dataset.idx, 10)];
    const expected = it[it.hide];
    const val = inp.value.trim();
    const ok = val !== '' && parseInt(val, 10) === expected;
    inp.disabled = true;
    inp.classList.remove('empty');
    const card = inp.closest('.ex');
    card.classList.add(ok ? 'ok' : 'bad');
    card.querySelector('.mark').textContent = ok ? '✓' : '✗ ' + expected;
    if (ok) correct++;
    items.push({ q: itemText(it), given: val, answer: expected, ok });
  });

  return { correct, items, pts: correct * POINTS_PER_CORRECT * multiplier(sheet.cfg) };
}

function checkSheet() {
  if (!sheet || sheet.checked) return;
  const p = currentProfile();
  if (!p) { openProfiles(); return; }
  const total = sheet.items.length;
  const r = sheet.cfg.type === 'comper' ? checkComper() : checkNumbers();
  if (!r) return;
  const { correct, items } = r;
  const pts = r.pts + (correct === total ? PERFECT_BONUS : 0);

  const perfect = correct === total;
  const label = configLabel(sheet.cfg);

  // actualizăm profilul (local imediat; în clasă trimitem și online)
  const rankBefore = rankInfo(p.points).index;
  p.points += pts;
  p.sheets += 1;
  p.correct += correct;
  p.answered += total;
  if (perfect) p.perfect += 1;
  p.history.unshift({ date: Date.now(), label, correct, total, points: pts });
  p.history = p.history.slice(0, 8);
  const rankAfter = rankInfo(p.points);

  showResult(correct, total, pts, perfect, rankAfter.index > rankBefore ? rankAfter.rank : null);
  renderHeader();
  if (pts > 0) bumpPoints();

  saveToCloud({ label, type: configType(sheet.cfg), correct, total, points: pts, perfect, items });
}

function saveToCloud(payload) {
  const st = $('#save-status');
  st.hidden = false;
  st.className = 'save-status';
  st.textContent = '☁️ Se trimite la profesor…';
  submitSheet(state.cls.code, state.cls.sid, payload)
    .then((s) => {
      remote = normalizeStudent(s);
      renderHeader();
      st.textContent = '✅ Salvat! Profesorul vede fișa ta.';
      st.classList.add('ok');
    })
    .catch((e) => {
      console.error(e);
      st.textContent = e && e.code === 'permission-denied'
        ? '⚠️ Ai trimis prea repede. Așteaptă câteva secunde, apoi apasă din nou. '
        : '⚠️ Nu s-a putut trimite fișa. ';
      st.classList.add('bad');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn small';
      b.textContent = 'Încearcă din nou';
      b.addEventListener('click', () => saveToCloud(payload));
      st.appendChild(b);
    });
}

function showResult(correct, total, pts, perfect, newRank) {
  $('#sheet-msg').hidden = true;
  $('#check-wrap').hidden = true;
  $('#sheet-hint').hidden = true;

  const stars = perfect ? 3 : correct >= 8 ? 2 : correct >= 5 ? 1 : 0;
  const starBox = $('#result-stars');
  starBox.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const s = document.createElement('span');
    s.textContent = '⭐';
    if (i >= stars) s.className = 'off';
    starBox.appendChild(s);
  }

  let title, text;
  if (perfect) {
    title = pick(PRAISE) + ' Toate corecte! 🎉';
    text = 'Ai rezolvat perfect toată fișa și primești bonus ' + PERFECT_BONUS + ' de puncte!';
  } else if (correct >= 8) {
    title = pick(PRAISE) + ' 👏';
    text = 'Ai rezolvat corect ' + correct + ' din ' + total + '. Uită-te la exercițiile roșii ca să vezi răspunsul bun.';
  } else if (correct >= 5) {
    title = 'Bine! 🙂';
    text = 'Ai rezolvat corect ' + correct + ' din ' + total + '. Mai exersează puțin și vei fi și mai bun!';
  } else {
    title = 'Nu-i nimic, mai încercăm! 💪';
    text = 'Ai rezolvat corect ' + correct + ' din ' + total + '. Fiecare fișă te face mai priceput!';
  }
  $('#result-title').textContent = title;
  $('#result-text').textContent = text;
  $('#result-points').textContent = '+' + pts + ' puncte ⭐';

  const ru = $('#result-rankup');
  if (newRank) {
    ru.textContent = 'Ai urcat la nivelul „' + newRank.name + '” ' + newRank.icon + '!';
    ru.hidden = false;
  } else {
    ru.hidden = true;
  }

  $('#result').hidden = false;
  $('#result').scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (perfect || newRank) confetti();
}

$('#again-btn').addEventListener('click', () => startSheet(sheet.cfg));
$('#menu-btn').addEventListener('click', openMenu);

$('#back-btn').addEventListener('click', async () => {
  const started = sheet && !sheet.checked && $all('#sheet .ans').some((i) => i.value);
  if (started && !(await ask({ title: 'Ieși din fișă?', text: 'Exercițiile începute nu vor primi puncte.', okLabel: 'Ies', cancelLabel: 'Rămân' }))) return;
  openMenu();
});

// ================== Confetti ==================
function confetti() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = $('#confetti');
  const bits = ['🎉', '⭐', '🎈', '✨', '🌟', '🍭'];
  for (let i = 0; i < 40; i++) {
    const s = document.createElement('span');
    s.textContent = pick(bits);
    s.style.left = Math.random() * 100 + 'vw';
    s.style.animationDuration = (2 + Math.random() * 2) + 's';
    s.style.animationDelay = Math.random() * 0.8 + 's';
    box.appendChild(s);
  }
  setTimeout(() => { box.innerHTML = ''; }, 5000);
}

// ================== Navigare header ==================
$('#switch-btn').addEventListener('click', () => {
  if (inClass()) openClassPicker(state.cls.code);
  else openProfiles();
});

$('#logo-btn').addEventListener('click', () => {
  if (sheet && !sheet.checked && !$('#screen-exercise').hidden) {
    $('#back-btn').click();
  } else if (currentProfile()) {
    openMenu();
  } else {
    openProfiles();
  }
});

// ================== Pornire ==================
async function boot() {
  renderTableChoices();
  setupClassCard();

  if (!inClass()) { openProfiles(); return; }

  showScreen('screen-loading');
  try {
    const [s, cls] = await Promise.all([
      getStudent(state.cls.code, state.cls.sid),
      getClass(state.cls.code)
    ]);
    if (s && cls) {
      state.cls.grade = cls.grade;
      state.cls.className = cls.name;
      save();
      remote = normalizeStudent(s);
      openMenu();
      return;
    }
    // elevul a fost șters din clasă
    state.cls = null;
    save();
    openProfiles();
    showClassError('Numele tău nu mai este în clasă. Scrie din nou codul clasei.');
  } catch (e) {
    console.error(e);
    openProfiles();
    showClassError('Nu m-am putut conecta la clasă. Verifică internetul și apasă „Intră”.');
  }
}

boot();
