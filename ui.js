// Mici utilitare comune pentru paginile de profesor și administrator.

export const $ = (sel, root) => (root || document).querySelector(sel);

// Construiește elemente fără innerHTML (textul e mereu tratat ca text, nu cod).
export function el(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    e.append(kid instanceof Node ? kid : String(kid));
  }
  return e;
}

export function show(id, ids) {
  ids.forEach((x) => { document.getElementById(x).hidden = x !== id; });
}

export function toDate(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v === 'number') return new Date(v);
  if (v instanceof Date) return v;
  return null;
}

export function fmtWhen(v) {
  const d = toDate(v);
  if (!d) return '–';
  const now = new Date();
  const time = d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return 'azi, ' + time;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return 'ieri, ' + time;
  return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }) + ', ' + time;
}

export function pct(correct, answered) {
  return answered ? Math.round((correct / answered) * 100) + '%' : '–';
}

export function authError(e) {
  const code = (e && e.code) || '';
  const map = {
    'auth/invalid-credential': 'Email sau parolă greșită.',
    'auth/wrong-password': 'Email sau parolă greșită.',
    'auth/user-not-found': 'Email sau parolă greșită.',
    'auth/invalid-email': 'Adresa de email nu este validă.',
    'auth/too-many-requests': 'Prea multe încercări. Așteaptă câteva minute.',
    'auth/network-request-failed': 'Nu există conexiune la internet.',
    'auth/email-already-in-use': 'Există deja un cont cu acest email.',
    'auth/weak-password': 'Parola trebuie să aibă cel puțin 6 caractere.',
    'auth/user-disabled': 'Acest cont a fost dezactivat.',
    'permission-denied': 'Nu ai voie să faci această operație (verifică regulile Firestore).'
  };
  return map[code] || ('A apărut o eroare: ' + (e && e.message ? e.message : code));
}

// Afișează în ce categorie e o fișă (după codul salvat de pagina copiilor).
export function typeGroup(type) {
  const p = String(type || '').split('-');
  if (p[0] === 'mul') return 'Tabla înmulțirii';
  if (p[0] === 'comper') return 'Comper';
  if (p[0] === 'add') return p[1] === 'cu' ? 'Adunări cu trecere' : 'Adunări fără trecere';
  if (p[0] === 'sub') return p[1] === 'cu' ? 'Scăderi cu împrumut' : 'Scăderi fără împrumut';
  return 'Altele';
}

// ================== Fereastră de confirmare în pagină ==================
// Înlocuiește alert/confirm/prompt (pe care unele browsere sau ferestre
// integrate le blochează). Întoarce un Promise<boolean>.
//   ask({ title, text, okLabel, danger, typeToConfirm })
export function ask(opts) {
  const o = opts || {};
  return new Promise((resolve) => {
    const input = o.typeToConfirm
      ? el('input', { type: 'text', class: 'modal-input', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Confirmare' })
      : null;
    const err = el('p', { class: 'error', hidden: true });
    const ok = el('button', { type: 'button', class: 'btn ' + (o.danger ? 'danger-solid' : 'primary') }, o.okLabel || 'OK');
    const cancel = o.alertOnly ? null : el('button', { type: 'button', class: 'btn ghost' }, o.cancelLabel || 'Renunță');
    const box = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
      o.title ? el('h2', { text: o.title }) : null,
      o.text ? el('p', { class: 'modal-text', text: o.text }) : null,
      input ? el('p', { class: 'small-text' }, 'Scrie ', el('b', { text: o.typeToConfirm }), ' ca să confirmi:') : null,
      input,
      err,
      el('div', { class: 'modal-actions' }, cancel, ok));
    const overlay = el('div', { class: 'modal-overlay' }, box);

    const close = (value) => {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(value);
    };
    const tryOk = () => {
      if (input && input.value.trim().toLowerCase() !== String(o.typeToConfirm).toLowerCase()) {
        err.textContent = 'Textul nu se potrivește.';
        err.hidden = false;
        input.focus();
        return;
      }
      close(true);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      else if (e.key === 'Enter' && (document.activeElement === input || document.activeElement === ok)) { e.preventDefault(); tryOk(); }
    };
    ok.addEventListener('click', tryOk);
    if (cancel) cancel.addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    document.addEventListener('keydown', onKey, true);
    document.body.append(overlay);
    (input || ok).focus();
  });
}

export function tell(text, title) {
  return ask({ text, title, alertOnly: true, okLabel: 'OK' });
}
