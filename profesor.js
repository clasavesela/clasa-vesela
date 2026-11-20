import { fb, isConfigured } from './firebase.js';
import { ADMIN_UID } from './firebase-config.js';
import { $, el, show, toDate, fmtWhen, pct, authError, typeGroup, ask, tell } from './ui.js';
import { gradeLabel, isGrade, currentGrade, nextGrade } from './comper.js';

const VIEWS = ['view-loading', 'view-off', 'view-login', 'view-denied', 'view-dash'];
const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🐵', '🦁', '🐰', '🐨', '🦄', '🐙', '🐢', '🐧', '🐶', '🐱', '🦖', '🐝'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // fără 0/O și 1/I, ca să nu se încurce copiii

let F = null;          // module Firebase
let user = null;       // contul autentificat
let teacher = null;    // documentul din „teachers”
let classes = [];
let selected = null;   // codul clasei selectate
let students = [];
let unsubClasses = null;
let unsubStudents = null;
let unsubTeacher = null;
let detailSid = null;
let pendingNotice = null; // mesaj de arătat după ce contul s-a șters singur

// ================== Pornire ==================
if (!isConfigured) {
  show('view-off', VIEWS);
} else {
  start().catch((e) => {
    console.error(e);
    $('#view-loading').textContent = 'Nu m-am putut conecta. Verifică internetul și reîncarcă pagina.';
  });
}

async function start() {
  F = await fb();
  const { onAuthStateChanged } = F.authMod;
  onAuthStateChanged(F.auth, onUser);
}

async function onUser(u) {
  stopListeners();
  user = u;
  teacher = null;
  $('#who').hidden = true;

  if (!u) {
    show('view-login', VIEWS);
    if (pendingNotice) {
      $('#login-info').textContent = pendingNotice;
      $('#login-info').hidden = false;
      pendingNotice = null;
    }
    return;
  }
  if (u.isAnonymous) { await F.authMod.signOut(F.auth); return; }

  show('view-loading', VIEWS);
  const { doc, getDoc } = F.fsMod;
  try {
    const snap = await getDoc(doc(F.db, 'teachers', u.uid));
    if (!snap.exists() && await removeIfDeleted(u)) return;
    if (!snap.exists() || snap.data().active !== true) {
      $('#denied-text').textContent = snap.exists()
        ? 'Contul tău de profesor a fost dezactivat. Contactează administratorul.'
        : 'Acest cont nu este cont de profesor. Contactează administratorul.';
      show('view-denied', VIEWS);
      return;
    }
    teacher = snap.data();
  } catch (e) {
    console.error(e);
    $('#denied-text').textContent = authError(e);
    show('view-denied', VIEWS);
    return;
  }

  $('#who-name').textContent = '🧑‍🏫 ' + (teacher.name || u.email);
  $('#who').hidden = false;
  show('view-dash', VIEWS);
  listenClasses();
  watchTeacher(u.uid);
}

// Dacă administratorul șterge sau dezactivează contul, profesorul iese imediat.
function watchTeacher(uid) {
  const { doc, onSnapshot } = F.fsMod;
  unsubTeacher = onSnapshot(doc(F.db, 'teachers', uid), (snap) => {
    if (snap.exists() && snap.data().active === true) {
      teacher = snap.data();
      renderClasses();
      return;
    }
    if (snap.exists()) {
      kickOut('Contul tău de profesor a fost dezactivat. Contactează administratorul.');
      return;
    }
    stopListeners();
    removeIfDeleted(user).then((done) => {
      if (!done) kickOut('Contul tău de profesor a fost șters. Contactează administratorul.');
    });
  }, () => kickOut('Contul tău de profesor nu mai are acces. Contactează administratorul.'));
}

// Când administratorul șterge un profesor, îl marchează în „deletedTeachers”.
// Contul de autentificare nu poate fi șters de altcineva fără server, așa că
// se șterge singur aici, prima dată când profesorul șters încearcă să intre.
async function removeIfDeleted(u) {
  if (!u || u.uid === ADMIN_UID) return false; // contul de administrator nu se șterge niciodată
  const { doc, getDoc, deleteDoc, setDoc } = F.fsMod;
  const ref = doc(F.db, 'deletedTeachers', u.uid);
  let mark;
  try { mark = await getDoc(ref); } catch (e) { return false; }
  if (!mark.exists()) return false;
  const data = mark.data();
  try {
    await deleteDoc(ref);
    pendingNotice = 'Contul tău de profesor a fost șters de administrator, iar datele tale de autentificare au fost șterse definitiv.';
    await F.authMod.deleteUser(u); // după asta pagina revine singură la ecranul de autentificare
    return true;
  } catch (e) {
    // de ex. „requires-recent-login”: punem marcajul la loc, contul se va șterge la următoarea intrare
    console.error(e);
    pendingNotice = null;
    try { await setDoc(ref, data); } catch (e2) { /* ignorăm */ }
    return false;
  }
}

function kickOut(text) {
  stopListeners();
  $('#who').hidden = true;
  $('#denied-text').textContent = text;
  show('view-denied', VIEWS);
}

function stopListeners() {
  if (unsubTeacher) { unsubTeacher(); unsubTeacher = null; }
  if (unsubClasses) { unsubClasses(); unsubClasses = null; }
  if (unsubStudents) { unsubStudents(); unsubStudents = null; }
  classes = [];
  students = [];
  selected = null;
  detailSid = null;
}

// ================== Autentificare ==================
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#login-error');
  err.hidden = true;
  $('#login-info').hidden = true;
  const btn = $('#login-btn');
  btn.disabled = true;
  try {
    await F.authMod.signInWithEmailAndPassword(F.auth, $('#login-email').value.trim(), $('#login-pass').value);
    $('#login-pass').value = '';
  } catch (ex) {
    err.textContent = authError(ex);
    err.hidden = false;
  } finally {
    btn.disabled = false;
  }
});

$('#forgot-btn').addEventListener('click', async () => {
  const email = $('#login-email').value.trim();
  const err = $('#login-error');
  const info = $('#login-info');
  err.hidden = true;
  info.hidden = true;
  if (!email) {
    err.textContent = 'Scrie mai întâi adresa de email în căsuța de sus.';
    err.hidden = false;
    return;
  }
  try {
    await F.authMod.sendPasswordResetEmail(F.auth, email);
  } catch (ex) {
    if (ex.code === 'auth/invalid-email') {
      err.textContent = authError(ex);
      err.hidden = false;
      return;
    }
  }
  // același mesaj indiferent dacă emailul există, ca să nu dezvăluim conturi
  info.textContent = 'Dacă există un cont cu acest email, ai primit un mesaj pentru schimbarea parolei.';
  info.hidden = false;
});

$('#pass-btn').addEventListener('click', async () => {
  if (!user || !user.email) return;
  try {
    await F.authMod.sendPasswordResetEmail(F.auth, user.email);
    tell('Ți-am trimis pe ' + user.email + ' un email cu link pentru schimbarea parolei.', 'Email trimis ✅');
  } catch (e) {
    tell(authError(e), 'Eroare');
  }
});

const logout = () => F.authMod.signOut(F.auth);
$('#logout-btn').addEventListener('click', logout);
$('#denied-logout').addEventListener('click', logout);

// ================== Clase ==================
function listenClasses() {
  const { collection, query, where, onSnapshot } = F.fsMod;
  const q = query(collection(F.db, 'classes'), where('teacherUid', '==', user.uid));
  unsubClasses = onSnapshot(q, (snap) => {
    classes = snap.docs.map((d) => ({ code: d.id, ...d.data() }));
    classes.sort((a, b) => a.name.localeCompare(b.name, 'ro'));
    if (selected && !classes.some((c) => c.code === selected)) selectClass(null);
    if (!selected && classes.length === 1) selectClass(classes[0].code);
    renderClasses();
  }, (e) => {
    console.error(e);
    $('#class-error').textContent = authError(e);
    $('#class-error').hidden = false;
  });
}

// Câte clase are voie să creeze profesorul (setat de administrator; 5 dacă lipsește).
function classLimit() {
  return teacher && Number.isInteger(teacher.maxClasses) ? teacher.maxClasses : 5;
}

function renderLimit() {
  const max = classLimit();
  const full = classes.length >= max;
  $('#class-limit').textContent = 'Clase create: ' + classes.length + ' din ' + max + ' permise.';
  $('#class-limit').classList.toggle('error', full);
  $('#class-full').hidden = !full;
  $('#new-class-name').disabled = full;
  $('#new-class-btn').disabled = full;
}

function renderClasses() {
  renderLimit();
  const list = $('#class-list');
  list.innerHTML = '';
  $('#no-classes').hidden = classes.length > 0;
  classes.forEach((c) => {
    list.append(el('li', null,
      el('button', {
        type: 'button',
        class: 'class-btn' + (c.code === selected ? ' active' : ''),
        onclick: () => selectClass(c.code)
      }, el('span', { text: c.name }), el('small', { text: c.code }))
    ));
  });
  const c = classes.find((x) => x.code === selected);
  if (c) {
    $('#cd-name').textContent = c.name;
    $('#cd-code').textContent = c.code;
    const g = currentGrade(c.grade, c.gradeYear);
    $('#cd-grade').textContent = isGrade(g)
      ? '🏆 Teste Comper pentru: ' + gradeLabel(g) + ' (setată de administrator' +
        (Number.isInteger(c.gradeYear) ? '; din 1 septembrie trece automat la ' + gradeLabel(nextGrade(g)) : '') + ')'
      : '🏆 Testele Comper nu sunt disponibile: administratorul nu ți-a setat încă clasa.';
  }
}

function genCode() {
  let s = '';
  const buf = new Uint32Array(6);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 6; i++) s += CODE_CHARS[buf[i] % CODE_CHARS.length];
  return s;
}

$('#new-class-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#new-class-name').value.trim().replace(/\s+/g, ' ');
  const err = $('#class-error');
  err.hidden = true;
  if (!name) return;
  if (classes.length >= classLimit()) {
    err.textContent = 'Ai ajuns la numărul maxim de clase (' + classLimit() + '). Contactează administratorul dacă ai nevoie de mai multe.';
    err.hidden = false;
    return;
  }
  const { doc, getDoc, writeBatch, increment, serverTimestamp } = F.fsMod;
  try {
    for (let i = 0; i < 8; i++) {
      const code = genCode();
      const ref = doc(F.db, 'classes', code);
      if ((await getDoc(ref)).exists()) continue; // cod deja folosit
      // clasa și numărătoarea de clase a profesorului se scriu împreună (regulile verifică limita)
      const batch = writeBatch(F.db);
      batch.update(doc(F.db, 'teachers', user.uid), { classCount: increment(1), classOp: code });
      batch.set(ref, {
        name,
        teacherUid: user.uid,
        teacherName: teacher.name || user.email,
        grade: isGrade(teacher.grade) ? teacher.grade : null,
        gradeYear: Number.isInteger(teacher.gradeYear) ? teacher.gradeYear : null,
        createdAt: serverTimestamp()
      });
      await batch.commit();
      $('#new-class-name').value = '';
      selectClass(code);
      return;
    }
    throw new Error('Nu am găsit un cod liber. Încearcă din nou.');
  } catch (ex) {
    console.error(ex);
    err.textContent = authError(ex);
    err.hidden = false;
  }
});

$('#copy-code').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(selected);
    $('#copy-code').textContent = 'Copiat ✓';
    setTimeout(() => { $('#copy-code').textContent = 'Copiază'; }, 1500);
  } catch (e) { /* clipboard indisponibil */ }
});

function selectClass(code) {
  if (unsubStudents) { unsubStudents(); unsubStudents = null; }
  selected = code;
  students = [];
  closeDetail();
  $('#no-selection').hidden = !!code;
  $('#class-detail').hidden = !code;
  renderClasses();
  if (!code) return;

  const { collection, onSnapshot } = F.fsMod;
  unsubStudents = onSnapshot(collection(F.db, 'classes', code, 'students'), (snap) => {
    students = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderStudents();
  }, (e) => console.error(e));
}

$('#delete-class').addEventListener('click', async () => {
  const c = classes.find((x) => x.code === selected);
  if (!c) return;
  const ok = await ask({
    title: 'Ștergi clasa „' + c.name + '”?',
    text: 'Se vor șterge toți elevii și toate fișele lor.\nNu se poate anula.',
    typeToConfirm: c.code,
    okLabel: 'Șterge definitiv',
    danger: true
  });
  if (!ok) return;
  const code = c.code;
  try {
    const { collection, getDocs, doc, deleteDoc } = F.fsMod;
    const studs = await getDocs(collection(F.db, 'classes', code, 'students'));
    for (const s of studs.docs) await deleteStudentDocs(code, s.id);
    selectClass(null);
    // ștergerea clasei eliberează un loc din limita de clase
    const { writeBatch, increment } = F.fsMod;
    const batch = writeBatch(F.db);
    const count = Number.isInteger(teacher.classCount) ? teacher.classCount : 0;
    batch.update(doc(F.db, 'teachers', user.uid), { classCount: count > 0 ? increment(-1) : 0, classOp: code });
    batch.delete(doc(F.db, 'classes', code));
    await batch.commit();
  } catch (e) {
    console.error(e);
    tell(authError(e), 'Eroare');
  }
});

// ================== Elevi ==================
function studentSortValue(s, by) {
  if (by === 'points') return -(s.points || 0);
  if (by === 'active') { const d = toDate(s.lastActive); return d ? -d.getTime() : 0; }
  if (by === 'percent') return s.answered ? -(s.correct / s.answered) : 1;
  return 0;
}

function renderStudents() {
  const by = $('#sort-by').value;
  const list = students.slice().sort((a, b) =>
    (studentSortValue(a, by) - studentSortValue(b, by)) || a.name.localeCompare(b.name, 'ro'));

  const body = $('#students-body');
  body.innerHTML = '';
  $('#no-students').hidden = list.length > 0;
  $('#students-table').hidden = list.length === 0;

  list.forEach((s) => {
    body.append(el('tr', { class: s.id === detailSid ? 'selected' : null },
      el('td', { class: 'cell-title' }, el('span', { class: 'tavatar', text: s.avatar || '🙂' }), ' ', el('b', { text: s.name })),
      el('td', { 'data-label': 'Puncte', text: '⭐ ' + (s.points || 0) }),
      el('td', { 'data-label': 'Fișe', text: String(s.sheets || 0) }),
      el('td', { 'data-label': 'Corecte', text: pct(s.correct, s.answered) }),
      el('td', { 'data-label': 'Ultima activitate', text: fmtWhen(s.lastActive) }),
      el('td', { 'data-label': 'Ultima fișă', class: 'muted-cell', text: s.lastLabel || '–' }),
      el('td', { class: 'actions' },
        el('button', { type: 'button', class: 'btn small', onclick: () => openDetail(s.id) }, 'Detalii'),
        el('button', { type: 'button', class: 'del-btn', title: 'Șterge elevul', 'aria-label': 'Șterge elevul ' + s.name, onclick: () => removeStudent(s) }, '🗑️')
      )
    ));
  });

  // statistici clasă
  const sheets = students.reduce((n, s) => n + (s.sheets || 0), 0);
  const correct = students.reduce((n, s) => n + (s.correct || 0), 0);
  const answered = students.reduce((n, s) => n + (s.answered || 0), 0);
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const active = students.filter((s) => { const d = toDate(s.lastActive); return d && d.getTime() > weekAgo; }).length;
  $('#cs-students').textContent = students.length;
  $('#cs-sheets').textContent = sheets;
  $('#cs-percent').textContent = pct(correct, answered);
  $('#cs-active').textContent = active;

  if (detailSid) {
    const s = students.find((x) => x.id === detailSid);
    if (!s) closeDetail();
    else $('#sd-title').textContent = (s.avatar || '') + ' ' + s.name + ' · ⭐ ' + (s.points || 0);
  }
}

$('#sort-by').addEventListener('change', renderStudents);

$('#add-students-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#students-error');
  err.hidden = true;
  const existing = new Set(students.map((s) => s.name.toLowerCase()));
  const names = [];
  $('#new-students').value.split('\n').forEach((line) => {
    const n = line.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (n && !existing.has(n.toLowerCase())) { existing.add(n.toLowerCase()); names.push(n); }
  });
  if (!names.length) {
    err.textContent = 'Nu există nume noi de adăugat (poate sunt deja în listă).';
    err.hidden = false;
    return;
  }
  const { collection, doc, writeBatch, serverTimestamp } = F.fsMod;
  try {
    const batch = writeBatch(F.db);
    names.forEach((name) => {
      batch.set(doc(collection(F.db, 'classes', selected, 'students')), {
        name,
        avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
        points: 0, sheets: 0, perfect: 0, correct: 0, answered: 0,
        recent: [], lastLabel: '', lastActive: null,
        createdAt: serverTimestamp()
      });
    });
    await batch.commit();
    $('#new-students').value = '';
  } catch (ex) {
    console.error(ex);
    err.textContent = authError(ex);
    err.hidden = false;
  }
});

async function deleteStudentDocs(code, sid) {
  const { collection, getDocs, doc, deleteDoc } = F.fsMod;
  const res = await getDocs(collection(F.db, 'classes', code, 'students', sid, 'results'));
  for (const r of res.docs) await deleteDoc(r.ref);
  await deleteDoc(doc(F.db, 'classes', code, 'students', sid));
}

async function removeStudent(s) {
  const ok = await ask({ title: 'Ștergi elevul „' + s.name + '”?', text: 'Se vor șterge și toate fișele lui. Nu se poate anula.', okLabel: 'Șterge', danger: true });
  if (!ok) return;
  try {
    if (detailSid === s.id) closeDetail();
    await deleteStudentDocs(selected, s.id);
  } catch (e) {
    console.error(e);
    tell(authError(e), 'Eroare');
  }
}

// ================== Detalii elev ==================
function closeDetail() {
  detailSid = null;
  $('#student-detail').hidden = true;
  $all('#students-body tr.selected').forEach((tr) => tr.classList.remove('selected'));
}

function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

$('#sd-close').addEventListener('click', () => { closeDetail(); renderStudents(); });

async function openDetail(sid) {
  const s = students.find((x) => x.id === sid);
  if (!s) return;
  detailSid = sid;
  renderStudents();
  $('#sd-title').textContent = (s.avatar || '') + ' ' + s.name + ' · ⭐ ' + (s.points || 0);
  $('#sd-cats').innerHTML = '';
  $('#sd-results').innerHTML = '';
  $('#sd-empty').hidden = true;
  $('#student-detail').hidden = false;
  $('#student-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });

  const { collection, query, orderBy, limit, getDocs } = F.fsMod;
  let results;
  try {
    const snap = await getDocs(query(
      collection(F.db, 'classes', selected, 'students', sid, 'results'),
      orderBy('date', 'desc'), limit(60)));
    results = snap.docs.map((d) => d.data());
  } catch (e) {
    console.error(e);
    $('#sd-empty').textContent = authError(e);
    $('#sd-empty').hidden = false;
    return;
  }
  if (detailSid !== sid) return; // între timp s-a ales alt elev

  $('#sd-empty').textContent = 'Nu a rezolvat încă nicio fișă.';
  $('#sd-empty').hidden = results.length > 0;

  // procent pe categorii
  const cats = {};
  results.forEach((r) => {
    const g = typeGroup(r.type);
    cats[g] = cats[g] || { c: 0, t: 0, n: 0 };
    cats[g].c += r.correct; cats[g].t += r.total; cats[g].n += 1;
  });
  Object.entries(cats).forEach(([g, v]) => {
    const p = v.t ? Math.round(v.c / v.t * 100) : 0;
    $('#sd-cats').append(el('div', { class: 'cat ' + (p >= 80 ? 'good' : p >= 50 ? 'mid' : 'low') },
      el('b', { text: p + '%' }), el('span', { text: g }), el('small', { text: v.n + (v.n === 1 ? ' fișă' : ' fișe') })));
  });

  results.forEach((r) => {
    const wrong = (r.items || []).filter((i) => !i.ok);
    $('#sd-results').append(el('li', null,
      el('div', { class: 'row-between' },
        el('span', null, el('b', { text: r.label }), ' · ', el('span', { class: 'muted', text: fmtWhen(r.date) })),
        el('span', { class: 'res-score ' + (r.correct === r.total ? 'good' : r.correct >= 5 ? 'mid' : 'low'), text: r.correct + '/' + r.total + ' · +' + r.points + ' ⭐' })
      ),
      wrong.length
        ? el('div', { class: 'wrong-list' }, wrong.map((i) =>
            el('span', { class: 'wrong' },
              String(r.type || '').startsWith('comper') ? i.q : i.q.replace('?', '…'), ' → ',
              i.given === '' ? el('i', { text: 'necompletat' }) : el('s', { text: i.given }),
              ' ', el('b', { text: String(i.answer) }))))
        : el('div', { class: 'muted small-text', text: 'Fără greșeli 🎉' })
    ));
  });
}
