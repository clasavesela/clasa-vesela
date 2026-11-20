// Partea online pentru copii: găsește clasa, lista de elevi, salvează fișele.
import { fb, isConfigured } from './firebase.js';
import { currentGrade } from './comper.js';

export { isConfigured };

const APP_NAME = 'copii';

async function ready() {
  const f = await fb(APP_NAME);
  await f.auth.authStateReady();
  if (!f.auth.currentUser) await f.authMod.signInAnonymously(f.auth);
  return f;
}

export function normCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function getClass(code) {
  code = normCode(code);
  if (code.length < 4) return null;
  const f = await ready();
  const { doc, getDoc } = f.fsMod;
  const snap = await getDoc(doc(f.db, 'classes', code));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { code, name: d.name, grade: currentGrade(d.grade, d.gradeYear) };
}

export async function listStudents(code) {
  const f = await ready();
  const { collection, getDocs } = f.fsMod;
  const snap = await getDocs(collection(f.db, 'classes', normCode(code), 'students'));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  return list;
}

export async function getStudent(code, sid) {
  const f = await ready();
  const { doc, getDoc } = f.fsMod;
  const snap = await getDoc(doc(f.db, 'classes', normCode(code), 'students', sid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Salvează o fișă: actualizează punctele elevului și păstrează fișa completă
// (cu răspunsurile copilului) pentru profesor.
export async function submitSheet(code, sid, r) {
  const f = await ready();
  const { doc, collection, runTransaction, serverTimestamp } = f.fsMod;
  const sref = doc(f.db, 'classes', normCode(code), 'students', sid);
  const rref = doc(collection(sref, 'results'));

  return runTransaction(f.db, async (tx) => {
    const snap = await tx.get(sref);
    if (!snap.exists()) throw new Error('Elevul nu mai există în clasă.');
    const o = snap.data();
    const recent = [
      { date: Date.now(), label: r.label, correct: r.correct, total: r.total, points: r.points }
    ].concat(o.recent || []).slice(0, 8);

    const upd = {
      points: (o.points || 0) + r.points,
      sheets: (o.sheets || 0) + 1,
      perfect: (o.perfect || 0) + (r.perfect ? 1 : 0),
      correct: (o.correct || 0) + r.correct,
      answered: (o.answered || 0) + r.total,
      recent: recent,
      lastLabel: r.label,
      lastActive: serverTimestamp()
    };
    tx.update(sref, upd);
    tx.set(rref, {
      date: serverTimestamp(),
      label: r.label,
      type: r.type,
      correct: r.correct,
      total: r.total,
      points: r.points,
      items: r.items
    });
    return { id: sid, ...o, ...upd };
  });
}
