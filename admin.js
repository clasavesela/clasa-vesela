import { fb, isConfigured } from './firebase.js';
import { firebaseConfig, ADMIN_UID } from './firebase-config.js';
import { $, el, show, fmtWhen, authError, ask, tell } from './ui.js';
import { GRADES, gradeLabel, isGrade, schoolYear, currentGrade, nextGrade } from './comper.js';

// IMPORTANT: verificarea de aici doar ascunde pagina. Protecția reală e în
// firestore.rules: numai contul cu ADMIN_UID poate crea / modifica profesori.

const VIEWS = ['view-loading', 'view-off', 'view-login', 'view-denied', 'view-dash'];

let F = null;
let teachers = [];
let classes = [];
let pendingDeletes = [];
let teachersLoaded = false;
let classesLoaded = false;
let unsubs = [];

if (!isConfigured || /^PUNE/.test(ADMIN_UID)) {
  show('view-off', VIEWS);
} else {
  start().catch((e) => {
    console.error(e);
    $('#view-loading').textContent = 'Nu m-am putut conecta. Verifică internetul și reîncarcă pagina.';
  });
}

async function start() {
  F = await fb();
  F.authMod.onAuthStateChanged(F.auth, onUser);
}

function onUser(u) {
  unsubs.forEach((f) => f());
  unsubs = [];
  $('#who').hidden = true;
  if (!u) { show('view-login', VIEWS); return; }
  if (u.uid !== ADMIN_UID) { show('view-denied', VIEWS); return; }

  $('#who-name').textContent = '🔐 ' + u.email;
  $('#who').hidden = false;
  show('view-dash', VIEWS);

  const { collection, onSnapshot } = F.fsMod;
  unsubs.push(onSnapshot(collection(F.db, 'teachers'), (snap) => {
    teachersLoaded = true;
    teachers = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    teachers.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ro'));
    render();
    syncGrades();
  }, (e) => console.error(e)));
  unsubs.push(onSnapshot(collection(F.db, 'deletedTeachers'), (snap) => {
    pendingDeletes = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    renderPending();
  }, (e) => console.error(e)));
  unsubs.push(onSnapshot(collection(F.db, 'classes'), (snap) => {
    classesLoaded = true;
    classes = snap.docs.map((d) => ({ code: d.id, ...d.data() }));
    classes.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ro'));
    render();
    syncGrades();
  }, (e) => console.error(e)));
}

// ================== Autentificare ==================
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#login-error');
  err.hidden = true;
  $('#login-btn').disabled = true;
  try {
    await F.authMod.signInWithEmailAndPassword(F.auth, $('#login-email').value.trim(), $('#login-pass').value);
    $('#login-pass').value = '';
  } catch (ex) {
    err.textContent = authError(ex);
    err.hidden = false;
  } finally {
    $('#login-btn').disabled = false;
  }
});

const logout = () => F.authMod.signOut(F.auth);
$('#logout-btn').addEventListener('click', logout);
$('#denied-logout').addEventListener('click', logout);

// ================== Profesor nou ==================
function randomPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = new Uint32Array(12);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => chars[n % chars.length]).join('');
}

$('#gen-pass').addEventListener('click', () => { $('#t-pass').value = randomPassword(); });

$('#new-teacher-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#t-name').value.trim();
  const email = $('#t-email').value.trim();
  const pass = $('#t-pass').value;
  const grade = parseInt($('#t-grade').value, 10);
  const err = $('#t-error');
  const done = $('#t-done');
  err.hidden = true;
  if (!isGrade(grade)) {
    err.textContent = 'Alege clasa la care predă profesorul.';
    err.hidden = false;
    return;
  }
  if (pass.length < 8) {
    err.textContent = 'Parola temporară trebuie să aibă cel puțin 8 caractere.';
    err.hidden = false;
    return;
  }
  if (!done.hidden && !(await ask({ title: 'Ai copiat datele?', text: 'Chenarul verde cu parola profesorului anterior va fi înlocuit.', okLabel: 'Da, continuă' }))) return;
  done.hidden = true;
  $('#t-submit').disabled = true;

  // Creăm contul într-o a doua instanță Firebase, ca administratorul
  // să rămână autentificat în pagina asta.
  const { appMod, authMod, fsMod } = F;
  const sec = appMod.initializeApp(firebaseConfig, 'creare-' + Date.now());
  let uid = null;
  try {
    const secAuth = authMod.initializeAuth(sec, { persistence: authMod.inMemoryPersistence });
    const cred = await authMod.createUserWithEmailAndPassword(secAuth, email, pass);
    uid = cred.user.uid;
    await authMod.signOut(secAuth);
  } catch (ex) {
    const pending = pendingDeletes.find((p) => (p.email || '').toLowerCase() === email.toLowerCase());
    err.textContent = ex.code !== 'auth/email-already-in-use' ? authError(ex)
      : pending
        ? 'Emailul aparține unui profesor șters, al cărui cont se șterge abia când încearcă să intre. ' +
          'Folosește alt email sau șterge contul din Firebase Console → Authentication → Users.'
        : 'Există deja un cont de autentificare cu acest email. Folosește alt email sau șterge contul ' +
          'din Firebase Console → Authentication → Users.';
    err.hidden = false;
  } finally {
    appMod.deleteApp(sec).catch(() => {});
  }

  if (uid) {
    try {
      await fsMod.setDoc(fsMod.doc(F.db, 'teachers', uid), {
        name, email, grade, gradeYear: schoolYear(), active: true, createdAt: fsMod.serverTimestamp()
      });
      const link = new URL('profesor.html', location.href).href;
      done.innerHTML = '';
      done.append(
        el('b', { text: '✅ Cont creat pentru ' + name + ' (' + gradeLabel(grade) + ').' }),
        el('div', { text: 'Trimite-i profesorului (pe un canal privat):' }),
        el('div', null, 'Pagina: ', el('a', { href: link, target: '_blank', text: link })),
        el('div', null, 'Email: ', el('code', { text: email })),
        el('div', null, 'Parolă temporară: ', el('code', { text: pass })),
        el('div', { class: 'small-text', text: 'Parola NU se mai poate vedea după ce închizi acest chenar – copiaz-o acum. După prima intrare, profesorul poate apăsa „Schimbă parola”.' }),
        el('button', {
          type: 'button',
          class: 'btn small mt',
          onclick: async (ev) => {
            const text = 'Pagina: ' + link + '\nEmail: ' + email + '\nParolă temporară: ' + pass;
            try {
              await navigator.clipboard.writeText(text);
              ev.target.textContent = 'Copiat ✓';
            } catch (e) {
              ev.target.textContent = 'Nu am putut copia – selectează textul de mai sus';
            }
          }
        }, '📋 Copiază datele')
      );
      done.hidden = false;
      $('#new-teacher-form').reset();
    } catch (ex) {
      console.error(ex);
      err.textContent = 'Contul de autentificare a fost creat, dar nu am putut salva rolul de profesor: ' + authError(ex);
      err.hidden = false;
    }
  }
  $('#t-submit').disabled = false;
});

// ================== Liste ==================
function render() {
  const counts = {};
  classes.forEach((c) => { counts[c.teacherUid] = (counts[c.teacherUid] || 0) + 1; });
  const byUid = Object.fromEntries(teachers.map((t) => [t.uid, t]));

  const tb = $('#teachers-body');
  tb.innerHTML = '';
  $('#no-teachers').textContent = teachersLoaded ? 'Nu există încă profesori.' : '⏳ Se încarcă…';
  $('#no-teachers').hidden = teachers.length > 0;
  teachers.forEach((t) => {
    tb.append(el('tr', { class: t.active ? null : 'inactive' },
      el('td', { class: 'cell-title' }, el('b', { text: t.name || '–' })),
      el('td', { 'data-label': 'Email', class: 'cell-wrap', text: t.email || '–' }),
      el('td', { 'data-label': 'Clasa (Comper)' }, el('div', { class: 'grade-cell' }, gradeSelect(t), gradeNote(t))),
      el('td', { 'data-label': 'Clase', text: String(counts[t.uid] || 0) }),
      el('td', { 'data-label': 'Stare' }, el('span', { class: 'pill ' + (t.active ? 'on' : 'off'), text: t.active ? 'Activ' : 'Dezactivat' })),
      el('td', { 'data-label': 'Creat', text: fmtWhen(t.createdAt) }),
      el('td', { class: 'actions' },
        el('button', { type: 'button', class: 'btn small', onclick: () => toggleActive(t) }, t.active ? 'Dezactivează' : 'Activează'),
        el('button', { type: 'button', class: 'btn small ghost', onclick: () => resetPassword(t) }, 'Email resetare parolă'),
        el('button', { type: 'button', class: 'btn small ghost danger', onclick: () => deleteTeacher(t) }, 'Șterge')
      )
    ));
  });

  const cb = $('#classes-body');
  cb.innerHTML = '';
  $('#no-all-classes').textContent = classesLoaded ? 'Nu există încă clase.' : '⏳ Se încarcă…';
  $('#no-all-classes').hidden = classes.length > 0;
  classes.forEach((c) => {
    const t = byUid[c.teacherUid];
    cb.append(el('tr', null,
      el('td', { class: 'cell-title' }, el('b', { text: c.name })),
      el('td', { 'data-label': 'Cod' }, el('span', { class: 'code-badge small', text: c.code })),
      el('td', { 'data-label': 'Profesor', class: 'cell-wrap' }, t ? t.name : el('span', { class: 'muted', text: (c.teacherName || '–') + ' (profesor șters)' })),
      el('td', { 'data-label': 'Creată', text: fmtWhen(c.createdAt) }),
      el('td', { class: 'actions' },
        el('button', { type: 'button', class: 'btn small ghost danger', onclick: () => deleteClass(c) }, 'Șterge'))
    ));
  });
}

// Clasa de acum a profesorului (ținând cont de trecerea automată din septembrie).
function teacherGrade(t) {
  return currentGrade(t.grade, t.gradeYear);
}

function gradeSelect(t) {
  const g = teacherGrade(t);
  const sel = el('select', { class: 'grade-select', 'aria-label': 'Clasa profesorului ' + (t.name || '') },
    isGrade(g) ? null : el('option', { value: '', text: '– nesetată –' }),
    GRADES.map((x) => el('option', { value: String(x), text: gradeLabel(x) })));
  sel.value = isGrade(g) ? String(g) : '';
  sel.addEventListener('change', () => setGrade(t, parseInt(sel.value, 10), sel));
  return sel;
}

function gradeNote(t) {
  const g = teacherGrade(t);
  if (!isGrade(g)) return null;
  if (!t.active) return el('small', { class: 'muted grade-note', text: 'Fixă cât timp contul e dezactivat' });
  return el('small', { class: 'muted grade-note', text: 'Din sept. ' + (schoolYear() + 1) + ': ' + gradeLabel(nextGrade(g)) });
}

// Scrie aceeași clasă pe profesor și pe toate clasele lui (copiii o citesc din clasă).
function gradeWrites(batch, t, grade, gradeYear) {
  const { doc } = F.fsMod;
  batch.update(doc(F.db, 'teachers', t.uid), { grade, gradeYear });
  classes.filter((c) => c.teacherUid === t.uid)
    .forEach((c) => batch.update(doc(F.db, 'classes', c.code), { grade, gradeYear }));
}

// Schimbarea manuală: noua clasă e cea din anul școlar de acum și,
// dacă profesorul e activ, crește singură în fiecare septembrie.
async function setGrade(t, grade, sel) {
  if (!isGrade(grade)) return;
  const back = () => { const g = teacherGrade(t); sel.value = isGrade(g) ? String(g) : ''; };
  const mine = classes.filter((c) => c.teacherUid === t.uid);
  const ok = await ask({
    title: 'Schimbi clasa pentru ' + t.name + '?',
    text: 'Noua clasă: ' + gradeLabel(grade) + '.\n' +
      (mine.length ? 'Elevii din ' + (mine.length === 1 ? 'clasa lui' : 'cele ' + mine.length + ' clase ale lui') + ' vor primi teste Comper pentru ' + gradeLabel(grade) + '.' : 'Nu are încă nicio clasă.') +
      (t.active ? '\nDin 1 septembrie ' + (schoolYear() + 1) + ' trece automat la ' + gradeLabel(nextGrade(grade)) + '.' : ''),
    okLabel: 'Schimbă'
  });
  if (!ok) { back(); return; }
  try {
    const batch = F.fsMod.writeBatch(F.db);
    gradeWrites(batch, t, grade, t.active ? schoolYear() : null);
    await batch.commit();
  } catch (e) {
    console.error(e);
    back();
    tell(authError(e), 'Eroare');
  }
}

// Ține clasele la zi cu profesorul lor și pornește trecerea automată pentru
// profesorii activi setați înainte să existe această funcție.
let syncing = false;
async function syncGrades() {
  if (syncing || !teachersLoaded || !classesLoaded) return;
  const { writeBatch, doc } = F.fsMod;
  const batch = writeBatch(F.db);
  let n = 0;
  teachers.forEach((t) => {
    if (!isGrade(t.grade)) return;
    let year = Number.isInteger(t.gradeYear) ? t.gradeYear : null;
    if (t.active && year === null) {
      year = schoolYear();
      batch.update(doc(F.db, 'teachers', t.uid), { gradeYear: year });
      n++;
    }
    classes.filter((c) => c.teacherUid === t.uid).forEach((c) => {
      if (c.grade !== t.grade || (Number.isInteger(c.gradeYear) ? c.gradeYear : null) !== year) {
        batch.update(doc(F.db, 'classes', c.code), { grade: t.grade, gradeYear: year });
        n++;
      }
    });
  });
  if (!n) return;
  syncing = true;
  try { await batch.commit(); } catch (e) { console.error(e); } finally { syncing = false; }
}

function renderPending() {
  const box = $('#pending-card');
  const list = $('#pending-list');
  list.innerHTML = '';
  box.hidden = pendingDeletes.length === 0;
  pendingDeletes.forEach((p) => {
    list.append(el('li', null, el('b', { text: p.name || '–' }), ' · ', el('span', { text: p.email || p.uid }),
      ' · ', el('span', { class: 'muted', text: 'șters ' + fmtWhen(p.deletedAt) })));
  });
}

async function toggleActive(t) {
  const ok = await ask(t.active
    ? { title: 'Dezactivezi profesorul?', text: t.name + ' nu va mai putea intra și nu va mai vedea clasele până îl reactivezi.', okLabel: 'Dezactivează', danger: true }
    : { title: 'Reactivezi profesorul?', text: t.name + ' va putea intra din nou și își va vedea clasele.', okLabel: 'Reactivează' });
  if (!ok) return;
  try {
    const batch = F.fsMod.writeBatch(F.db);
    batch.update(F.fsMod.doc(F.db, 'teachers', t.uid), { active: !t.active });
    const g = teacherGrade(t);
    // dezactivat: clasa rămâne cea de acum; reactivat: crește din nou din septembrie
    if (isGrade(g)) gradeWrites(batch, t, g, t.active ? null : schoolYear());
    await batch.commit();
  } catch (e) {
    tell(authError(e), 'Eroare');
  }
}

// ================== Ștergere ==================
// Șterge o clasă cu tot ce e în ea (elevi + fișe). Firestore nu șterge singur
// sub-colecțiile, așa că le parcurgem noi.
async function deleteClassDeep(code) {
  const { collection, getDocs, doc, deleteDoc } = F.fsMod;
  const studs = await getDocs(collection(F.db, 'classes', code, 'students'));
  for (const s of studs.docs) {
    const res = await getDocs(collection(s.ref, 'results'));
    for (const r of res.docs) await deleteDoc(r.ref);
    await deleteDoc(s.ref);
  }
  await deleteDoc(doc(F.db, 'classes', code));
  return studs.size;
}

function setBusy(on, text) {
  const b = $('#busy');
  b.textContent = text || '';
  b.hidden = !on;
  document.querySelectorAll('main button').forEach((x) => { x.disabled = on; });
}

async function deleteTeacher(t) {
  const { collection, query, where, getDocs, doc, deleteDoc } = F.fsMod;
  let mine;
  try {
    const snap = await getDocs(query(collection(F.db, 'classes'), where('teacherUid', '==', t.uid)));
    mine = snap.docs.map((d) => ({ code: d.id, ...d.data() }));
  } catch (e) {
    tell(authError(e), 'Eroare');
    return;
  }
  const what = mine.length
    ? 'Se vor șterge și ' + (mine.length === 1 ? 'clasa lui' : 'cele ' + mine.length + ' clase ale lui') + ':\n' +
      mine.map((c) => '• ' + c.name + ' (' + c.code + ')').join('\n') + '\ncu toți elevii și toate fișele lor.'
    : 'Nu are nicio clasă.';
  const ok = await ask({
    title: 'Ștergi profesorul ' + t.name + '?',
    text: what + '\n\nNu se poate anula.',
    typeToConfirm: t.email,
    okLabel: 'Șterge definitiv',
    danger: true
  });
  if (!ok) return;

  setBusy(true, '⏳ Șterg profesorul ' + t.name + '…');
  try {
    // întâi îi luăm accesul și îl marcăm pentru ștergerea contului de autentificare,
    // apoi ștergem clasele
    const batch = F.fsMod.writeBatch(F.db);
    batch.set(doc(F.db, 'deletedTeachers', t.uid), {
      email: t.email || '', name: t.name || '', deletedAt: F.fsMod.serverTimestamp()
    });
    batch.delete(doc(F.db, 'teachers', t.uid));
    await batch.commit();
    let students = 0;
    for (let i = 0; i < mine.length; i++) {
      setBusy(true, '⏳ Șterg clasa ' + (i + 1) + ' din ' + mine.length + ': ' + mine[i].name + '…');
      students += await deleteClassDeep(mine[i].code);
    }
    setBusy(false);
    tell('Am șters profesorul ' + t.name + ', ' + mine.length + (mine.length === 1 ? ' clasă' : ' clase') +
      ' și ' + students + (students === 1 ? ' elev' : ' elevi') + '.\n\n' +
      'Contul lui de autentificare (emailul) nu mai are acces la nimic și se va șterge singur ' +
      'prima dată când încearcă să intre. Până atunci emailul rămâne ocupat; dacă îl vrei liber imediat, ' +
      'șterge-l din Firebase Console → Authentication → Users.', 'Gata ✅');
  } catch (e) {
    console.error(e);
    setBusy(false);
    tell('Ștergerea s-a oprit la jumătate: ' + authError(e) +
      '\nClasele rămase apar în „Toate clasele” și le poți șterge de acolo.', 'Eroare');
  }
}

async function deleteClass(c) {
  const ok = await ask({
    title: 'Ștergi clasa „' + c.name + '”?',
    text: 'Se vor șterge toți elevii și toate fișele lor.\nNu se poate anula.',
    typeToConfirm: c.code,
    okLabel: 'Șterge definitiv',
    danger: true
  });
  if (!ok) return;
  setBusy(true, '⏳ Șterg clasa ' + c.name + '…');
  try {
    await deleteClassDeep(c.code);
  } catch (e) {
    console.error(e);
    tell(authError(e), 'Eroare');
  } finally {
    setBusy(false);
  }
}

async function resetPassword(t) {
  const ok = await ask({ title: 'Resetare parolă', text: 'Trimiți pe ' + t.email + ' un email pentru setarea unei parole noi?', okLabel: 'Trimite' });
  if (!ok) return;
  try {
    await F.authMod.sendPasswordResetEmail(F.auth, t.email);
    tell('Email trimis către ' + t.email + '.', 'Gata ✅');
  } catch (e) {
    tell(authError(e), 'Eroare');
  }
}
