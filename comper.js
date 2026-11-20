// =====================================================================
//  Exersare în stilul concursului Comper (matematică)
//  Problemele sunt ORIGINALE, generate automat după tipurile de itemi care
//  apar de obicei la Comper: șiruri, numere lipsă, probleme cu vârste,
//  picioare de animale, copii așezați în șir, trepte, balanțe cu fructe,
//  suma și diferența, ore, zilele săptămânii, bani, unități de măsură etc.
//  Fiecare test: 10 întrebări cu 4 variante (A–D), împărțite în 3 părți:
//    Partea I (ușor) – 4 întrebări, Partea a II-a (mediu) – 3, Partea a III-a (dificil) – 3.
// =====================================================================

// clasa: 0 = pregătitoare, 1 = I, 2 = a II-a, 3 = a III-a, 4 = a IV-a
export const GRADES = [0, 1, 2, 3, 4];
const GRADE_NAMES = ['pregătitoare', 'I', 'a II-a', 'a III-a', 'a IV-a'];

export function isGrade(g) {
  return Number.isInteger(g) && g >= 0 && g <= 4;
}

export function gradeLabel(g) {
  if (!isGrade(g)) return 'nesetată';
  return 'Clasa ' + GRADE_NAMES[g];
}

// ================== Trecerea automată la clasa următoare ==================
// Anul școlar începe la 1 septembrie: anul școlar 2026–2027 are numărul 2026.
export function schoolYear(d) {
  const t = d || new Date();
  return t.getMonth() >= 8 ? t.getFullYear() : t.getFullYear() - 1;
}

// Clasa de acum, pornind de la clasa setată (grade) în anul școlar gradeYear.
// Dacă gradeYear lipsește, clasa e fixă (de ex. cont de profesor dezactivat).
// După clasa a IV-a, învățătorul preia o generație nouă: clasa pregătitoare.
export function currentGrade(grade, gradeYear, d) {
  if (!isGrade(grade)) return null;
  if (!Number.isInteger(gradeYear)) return grade;
  const passed = Math.max(0, schoolYear(d) - gradeYear);
  return (grade + passed) % 5;
}

export function nextGrade(g) {
  return isGrade(g) ? (g + 1) % 5 : null;
}

export const TIER_POINTS = { 1: 10, 2: 20, 3: 30 };
export const TIER_NAMES = { 1: 'Partea I', 2: 'Partea a II-a', 3: 'Partea a III-a' };
const PLAN = [1, 1, 1, 1, 2, 2, 2, 3, 3, 3];

// ================== Utilitare ==================
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Construiește o întrebare cu 4 variante unice (răspunsul + 3 variante greșite).
function Q(text, answer, wrong, explain) {
  const ans = String(answer);
  const opts = [ans];
  const add = (v) => {
    if (v === null || v === undefined) return;
    if (typeof v === 'number' && (v < 0 || !Number.isInteger(v))) return;
    const s = String(v);
    if (!opts.includes(s) && opts.length < 4) opts.push(s);
  };
  wrong.forEach(add);
  // completăm, dacă e nevoie, cu numere apropiate de răspuns
  if (typeof answer === 'number') {
    const near = [1, 2, -1, 10, -2, 3, -10, 5, -3, 4];
    for (let i = 0; opts.length < 4 && i < near.length; i++) add(answer + near[i]);
  }
  return { text, options: shuffle(opts), answer: ans, explain: explain || '' };
}

// „1 an”, „5 ani”, „20 de ani”
function ani(n) { return n === 1 ? 'un an' : nr(n, 'ani'); }
// în română, de la 20 în sus (cu excepția 101–119, 201–219…) se spune „de”: „25 de nuci”
function nr(n, word) { const r = n % 100; return n + ((r === 0 && n > 0) || r >= 20 ? ' de ' : ' ') + word; }

const DAYS = ['luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică'];

function fmtTime(min) {
  min = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(min / 60), m = min % 60;
  return h + ':' + String(m).padStart(2, '0');
}

const NAMES_F = ['Ana', 'Maria', 'Ioana', 'Elena', 'Sofia', 'Daria', 'Irina', 'Bianca', 'Alexia', 'Carla'];
const NAMES_M = ['Mihai', 'Andrei', 'Radu', 'Ion', 'Matei', 'Luca', 'Vlad', 'Tudor', 'David', 'Rareș'];
const THINGS = [['creioane', 'creion'], ['bomboane', 'bomboană'], ['timbre', 'timbru'], ['bile', 'bilă'], ['nuci', 'nucă'], ['cărți', 'carte'], ['abțibilduri', 'abțibild']];

// ================== Generatoare ==================
// Fiecare generator: { id, tiers: { clasă: dificultate }, make(g) }

const GEN = [];

// --- Șiruri de numere ---
GEN.push({
  id: 'seq', tiers: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 },
  make(g) {
    if (g >= 3 && Math.random() < 0.4) {
      // șir în care pasul crește: +1, +2, +3, +4
      const a = rand(2, g === 3 ? 20 : 60);
      const s = [a, a + 1, a + 3, a + 6, a + 10];
      return Q('Ce număr continuă șirul: ' + s.slice(0, 4).join(', ') + ', … ?', s[4],
        [a + 9, a + 8, a + 11], 'Diferențele cresc: +1, +2, +3, apoi +4.');
    }
    if (g >= 3 && Math.random() < 0.4) {
      const a = rand(2, g === 3 ? 6 : 12);
      const s = [a, a * 2, a * 4, a * 8, a * 16];
      return Q('Ce număr continuă șirul: ' + s.slice(0, 4).join(', ') + ', … ?', s[4],
        [a * 12, a * 8 + a * 4 - a, a * 10], 'Fiecare număr este dublul celui dinainte.');
    }
    const step = g === 0 ? rand(1, 2) : g === 1 ? pick([2, 3, 5, 10]) : g === 2 ? pick([4, 5, 6, 7, 9, 25, 50]) : pick([12, 15, 25, 75, 125, 150]);
    const start = g === 0 ? rand(0, 8) : g === 1 ? rand(1, 30) : g === 2 ? rand(10, 300) : rand(100, g === 3 ? 3000 : 30000);
    const down = g >= 2 && Math.random() < 0.35;
    const s = [0, 1, 2, 3, 4].map((i) => down ? start + 4 * step - i * step : start + i * step);
    return Q('Ce număr continuă șirul: ' + s.slice(0, 4).join(', ') + ', … ?', s[4],
      [s[4] + 1, s[4] - 1, down ? s[4] - step : s[4] + step],
      'Din număr în număr ' + (down ? 'scădem ' : 'adunăm ') + step + '.');
  }
});

// --- Numărul care lipsește ---
GEN.push({
  id: 'missing', tiers: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 },
  make(g) {
    let a, b, c, op, text, wrongs;
    const kind = g <= 1 ? pick(['+', '−']) : g === 2 ? pick(['+', '−', '×']) : pick(['×', ':', '−', '+']);
    if (kind === '+') {
      c = g === 0 ? rand(5, 10) : g === 1 ? rand(20, 100) : g === 2 ? rand(200, 1000) : rand(1000, g === 3 ? 10000 : 100000);
      b = rand(1, c - 1); a = c - b;
      text = '□ + ' + b + ' = ' + c; wrongs = [c + b, a + 1, a - 1];
    } else if (kind === '−') {
      a = g === 0 ? rand(5, 10) : g === 1 ? rand(20, 100) : g === 2 ? rand(200, 1000) : rand(1000, g === 3 ? 10000 : 100000);
      c = rand(1, a - 1); b = a - c;
      text = a + ' − □ = ' + c; wrongs = [a + c, b + 1, b - 10];
      a = b; // răspunsul
    } else if (kind === '×') {
      b = rand(2, 9); a = g <= 2 ? rand(2, 10) : rand(11, g === 3 ? 99 : 999); c = a * b;
      text = '□ × ' + b + ' = ' + c; wrongs = [c - b, a + 1, a + b];
    } else {
      b = rand(2, 9); c = rand(g === 3 ? 4 : 50, g === 3 ? 99 : 999); a = b * c;
      text = '□ : ' + b + ' = ' + c; wrongs = [c + b, a + b, a - b];
    }
    op = kind;
    return Q('Ce număr trebuie pus în căsuță: ' + text + ' ?', a, wrongs,
      op === ':' ? 'Numărul căutat este ' + c + ' × ' + b + ' = ' + a + '.' : '');
  }
});

// --- Vecini / zeci și unități (mici) ---
GEN.push({
  id: 'neighbors', tiers: { 0: 1, 1: 1 },
  make(g) {
    if (g === 0) {
      const n = rand(1, 19);
      return Q('Ce număr se află între ' + (n - 1) + ' și ' + (n + 1) + '?', n, [n + 2, n - 2, n + 10]);
    }
    const z = rand(1, 9), u = rand(0, 9);
    if (z === u || u === 0) {
      const n = rand(11, 98);
      return Q('Care este vecinul mai mare al numărului ' + n + '?', n + 1, [n - 1, n + 10, n + 2]);
    }
    return Q('Ce număr are ' + z + ' zeci și ' + u + ' unități?', 10 * z + u, [10 * u + z, z + u, 10 * z]);
  }
});

// --- Numere „speciale” ---
const FACTS = {
  1: [
    ['Care este cel mai mare număr de două cifre?', 99, [98, 90, 100]],
    ['Care este cel mai mic număr de două cifre?', 10, [11, 1, 9]],
    ['Care este cel mai mic număr par de două cifre?', 10, [12, 11, 20]],
    ['Care este cel mai mare număr de două cifre egale?', 99, [88, 98, 11]],
    ['Câte zeci are numărul 70?', 7, [70, 0, 17]]
  ],
  2: [
    ['Care este cel mai mic număr de trei cifre diferite?', 102, [100, 123, 120]],
    ['Care este cel mai mare număr de trei cifre diferite?', 987, [999, 989, 978]],
    ['Care este cel mai mare număr impar de trei cifre?', 999, [998, 997, 989]],
    ['Care este cel mai mic număr de trei cifre care are suma cifrelor 3?', 102, [111, 120, 300]],
    ['Câte numere de două cifre există?', 90, [99, 89, 100]]
  ],
  3: [
    ['Care este cel mai mic număr de patru cifre diferite?', 1023, [1000, 1234, 1203]],
    ['Care este cel mai mare număr de patru cifre diferite?', 9876, [9999, 9867, 9786]],
    ['Care este cel mai mare număr par de patru cifre?', 9998, [9999, 9990, 9988]],
    ['Care este cel mai mic număr impar de patru cifre?', 1001, [1000, 1011, 1003]],
    ['Câte numere de trei cifre există?', 900, [999, 899, 1000]]
  ],
  4: [
    ['Care este cel mai mic număr de cinci cifre diferite?', 10234, [10000, 12345, 10243]],
    ['Care este cel mai mare număr de cinci cifre diferite?', 98765, [99999, 98756, 97865]],
    ['Câte numere de trei cifre există?', 900, [999, 899, 1000]],
    ['Care este cel mai mare număr de șase cifre?', 999999, [99999, 1000000, 999990]],
    ['Câte numere pare de două cifre există?', 45, [50, 44, 90]]
  ]
};
GEN.push({
  id: 'facts', tiers: { 1: 1, 2: 1, 3: 1, 4: 1 },
  make(g) {
    const f = pick(FACTS[g]);
    return Q(f[0], f[1], f[2]);
  }
});

// --- Suma cifrelor ---
GEN.push({
  id: 'digitsum1', tiers: { 2: 1, 3: 1, 4: 1 },
  make(g) {
    const n = g === 2 ? rand(100, 999) : g === 3 ? rand(1000, 9999) : rand(10000, 99999);
    const s = String(n).split('').reduce((x, d) => x + Number(d), 0);
    return Q('Care este suma cifrelor numărului ' + n + '?', s, [s + 1, s - 1, s + 2]);
  }
});

// --- Numărăm obiecte ---
GEN.push({
  id: 'count', tiers: { 0: 1, 1: 1 },
  make(g) {
    const pair = pick([['🍎', '🍐'], ['⭐', '🌙'], ['🐟', '🐚'], ['🌷', '🍀']]);
    const a = rand(3, g === 0 ? 7 : 9), b = rand(2, g === 0 ? 5 : 8);
    const row = shuffle(Array(a).fill(pair[0]).concat(Array(b).fill(pair[1]))).join(' ');
    if (g === 0) return Q('Câte ' + pair[0] + ' sunt aici?  ' + row, a, [b, a + b, a + 1]);
    return Q('Câte obiecte sunt în total?  ' + row, a + b, [a, a + b - 1, a + b + 1]);
  }
});

// --- Zilele săptămânii ---
GEN.push({
  id: 'days', tiers: { 0: 1, 1: 1, 2: 1, 3: 3, 4: 3 },
  make(g) {
    const d = rand(0, 6);
    let n, text, ans, explain;
    if (g === 0) {
      n = pick([1, 2]);
      text = 'Azi este ' + DAYS[d] + '. Ce zi va fi ' + (n === 1 ? 'mâine' : 'poimâine') + '?';
      ans = (d + n) % 7;
    } else if (g <= 2) {
      n = g === 1 ? rand(2, 6) : rand(8, 20);
      text = 'Azi este ' + DAYS[d] + '. Ce zi va fi peste ' + n + ' zile?';
      ans = (d + n) % 7;
      explain = g === 2 ? 'Peste 7 zile este din nou ' + DAYS[d] + '.' : '';
    } else {
      n = rand(15, g === 3 ? 40 : 100);
      text = 'Ieri a fost ' + DAYS[d] + '. Ce zi va fi peste ' + n + ' zile?';
      ans = (d + 1 + n) % 7;
      explain = 'Azi este ' + DAYS[(d + 1) % 7] + '. Din 7 în 7 zile se repetă aceeași zi.';
    }
    return Q(text, DAYS[ans], [DAYS[(ans + 1) % 7], DAYS[(ans + 6) % 7], DAYS[(ans + 2) % 7]], explain);
  }
});

// --- Problemă simplă (primește / dă) ---
GEN.push({
  id: 'story', tiers: { 0: 2, 1: 2, 2: 2, 3: 2, 4: 2 },
  make(g) {
    const name = pick(NAMES_F), th = pick(THINGS);
    if (g >= 3) {
      const r = rand(6, g === 3 ? 12 : 25), k = rand(6, g === 3 ? 12 : 40);
      const t = rand(5, Math.min(60, r * k - 1));
      return Q('Într-o livadă sunt ' + r + ' rânduri a câte ' + k + ' pomi. Se usucă ' + t + ' pomi. Câți pomi au rămas?',
        r * k - t, [r * k + t, r * k, r + k - t > 0 ? r * k - t - 10 : r * k - t + 10],
        r + ' × ' + k + ' = ' + (r * k) + ', apoi ' + (r * k) + ' − ' + t + ' = ' + (r * k - t) + '.');
    }
    const a = g === 0 ? rand(3, 9) : g === 1 ? rand(20, 50) : rand(150, 500);
    const b = g === 0 ? rand(1, 5) : g === 1 ? rand(5, 30) : rand(50, 300);
    const c = g === 0 ? rand(1, a) : g === 1 ? rand(5, a) : rand(40, a);
    const ans = a + b - c;
    return Q(name + ' are ' + a + ' ' + th[0] + '. Primește ' + b + ' de la mama și îi dă ' + c + ' fratelui. Câte ' + th[0] + ' are acum?',
      ans, [a + b + c, a - b + c, ans + 1]);
  }
});

// --- Vârste ---
GEN.push({
  id: 'age', tiers: { 0: 2, 1: 2, 2: 2 },
  make(g) {
    const a = g === 0 ? rand(4, 6) : rand(6, 9), b = rand(1, g === 0 ? 3 : 5), c = rand(1, g === 0 ? 2 : 6);
    const n = pick(NAMES_M);
    return Q(n + ' are ' + ani(a) + '. Sora lui este cu ' + ani(b) + ' mai mare. Câți ani va avea sora lui peste ' + ani(c) + '?',
      a + b + c, [a + b, a + c, a + b - c],
      'Acum sora are ' + a + ' + ' + b + ' = ' + (a + b) + ' ani.');
  }
});

GEN.push({
  id: 'ageback', tiers: { 0: 3, 1: 3, 2: 3, 3: 2, 4: 2 },
  make(g) {
    const n = pick(NAMES_M);
    if (g >= 3) {
      // suma vârstelor
      const k = rand(6, 10), t = rand(30, 40), y = rand(3, 6);
      return Q('Acum ' + n + ' are ' + ani(k) + ', iar tatăl lui are ' + ani(t) + '. Ce sumă vor avea vârstele lor peste ' + ani(y) + '?',
        k + t + 2 * y, [k + t + y, k + t, k + t + 3 * y],
        'Fiecare crește cu ' + y + ' ani, deci suma crește cu ' + (2 * y) + '.');
    }
    const p = rand(1, g === 0 ? 2 : 4), q = rand(1, g === 0 ? 2 : 3), v = g === 0 ? rand(7, 9) : rand(10, 15);
    return Q('Peste ' + ani(p) + ', ' + n + ' va avea ' + ani(v) + '. Câți ani avea ' + n + ' acum ' + ani(q) + '?',
      v - p - q, [v - p, v - q, v - p + q],
      'Acum are ' + v + ' − ' + p + ' = ' + (v - p) + ' ani.');
  }
});

// --- Mai multe / împreună ---
GEN.push({
  id: 'together', tiers: { 0: 3, 1: 3, 2: 2 },
  make(g) {
    const f = pick(NAMES_F), m = pick(NAMES_M), th = pick(THINGS);
    const a = g === 0 ? rand(2, 6) : g === 1 ? rand(10, 40) : rand(100, 400);
    const b = g === 0 ? rand(1, 4) : g === 1 ? rand(3, 20) : rand(20, 150);
    return Q(f + ' are ' + a + ' ' + th[0] + '. ' + m + ' are cu ' + b + ' mai multe decât ' + f + '. Câte ' + th[0] + ' au împreună?',
      a + a + b, [a + b, a + a, 2 * a + 2 * b],
      m + ' are ' + a + ' + ' + b + ' = ' + (a + b) + '. Împreună: ' + a + ' + ' + (a + b) + ' = ' + (2 * a + b) + '.');
  }
});

// --- Bani ---
GEN.push({
  id: 'money', tiers: { 0: 2, 1: 2, 2: 2, 3: 2, 4: 2 },
  make(g) {
    if (g <= 1) {
      const a = g === 0 ? rand(6, 10) : rand(30, 90), b = rand(g === 0 ? 2 : 10, a - 1);
      return Q('O jucărie costă ' + a + ' lei. Tu ai ' + b + ' lei. Câți lei îți mai trebuie ca s-o cumperi?',
        a - b, [a + b, a, a - b + 1]);
    }
    if (g === 2) {
      const a = rand(3, 9), b = rand(3, 9);
      return Q('Un caiet costă ' + a + ' lei. Cât costă ' + b + ' caiete?', a * b, [a + b, a * b - a, a * b + b]);
    }
    const B = g === 3 ? 50 : 100;
    let a, b, c;
    do { a = rand(3, 9); b = rand(2, 6); c = rand(5, g === 3 ? 15 : 40); } while (a * b + c >= B);
    const rest = B - a * b - c;
    return Q('Cumperi ' + b + ' caiete a câte ' + a + ' lei și un stilou de ' + c + ' lei. Plătești cu o bancnotă de ' + B + ' lei. Cât rest primești?',
      rest, [B - a * b, a * b + c, rest + a],
      'Plătești ' + (a * b) + ' + ' + c + ' = ' + (a * b + c) + ' lei.');
  }
});

// --- Picioare de animale ---
GEN.push({
  id: 'legs', tiers: { 1: 2, 2: 2, 3: 2, 4: 2 },
  make(g) {
    if (g === 1) {
      const x = rand(3, 6);
      return Q('În curte sunt ' + x + ' găini. Câte picioare au în total?', 2 * x, [x, 4 * x, 2 * x + 1]);
    }
    const x = rand(3, g === 2 ? 8 : 15), y = rand(2, g === 2 ? 6 : 12);
    return Q('În curte sunt ' + x + ' găini și ' + y + ' iepuri. Câte picioare au în total?',
      2 * x + 4 * y, [2 * x + 2 * y, 4 * x + 2 * y, x + y],
      'Găinile au câte 2 picioare, iepurii câte 4.');
  }
});

// --- Ore și minute ---
GEN.push({
  id: 'time', tiers: { 1: 2, 2: 2, 3: 2, 4: 2 },
  make(g) {
    if (g === 1) {
      const h = rand(7, 14), d = rand(2, 4);
      return Q('Acum este ora ' + h + '. Ce oră va fi peste ' + d + ' ore?', 'ora ' + (h + d),
        ['ora ' + (h + d + 1), 'ora ' + (h + d - 1), 'ora ' + (h + 2 * d)]);
    }
    const start = rand(7, 17) * 60 + rand(1, 11) * 5;
    const dur = g === 2 ? rand(3, 12) * 5 : rand(7, 23) * 5;
    const end = start + dur;
    return Q('Un film începe la ora ' + fmtTime(start) + ' și durează ' + nr(dur, 'minute') + '. La ce oră se termină?',
      fmtTime(end), [fmtTime(end + 10), fmtTime(end - 10), fmtTime(end + 60)],
      'O oră are 60 de minute.');
  }
});

// --- Copii așezați în șir ---
GEN.push({
  id: 'queue', tiers: { 0: 3, 1: 3, 2: 2, 3: 2, 4: 2 },
  make(g) {
    const max = g <= 1 ? 6 : g === 2 ? 15 : 30;
    const l = rand(2, max), r = rand(2, max), name = pick(NAMES_F);
    return Q('Într-un șir de copii, ' + name + ' este a ' + l + '-a de la stânga și a ' + r + '-a de la dreapta. Câți copii sunt în șir?',
      l + r - 1, [l + r, l + r - 2, l + r + 1],
      name + ' a fost numărată de două ori: ' + l + ' + ' + r + ' − 1 = ' + (l + r - 1) + '.');
  }
});

// --- Jumătate / dublu ---
GEN.push({
  id: 'halfdouble', tiers: { 2: 2, 3: 2, 4: 2 },
  make(g) {
    if (g === 2) {
      const a = rand(5, 50) * 2, b = rand(3, 40);
      return Q('Cât este jumătatea lui ' + a + ' adunată cu dublul lui ' + b + '?', a / 2 + 2 * b, [2 * a + b, a / 2 + b, a + 2 * b]);
    }
    const a = rand(5, g === 3 ? 50 : 250) * 4, b = rand(5, g === 3 ? 50 : 300);
    return Q('Cât este sfertul lui ' + a + ' adunat cu triplul lui ' + b + '?', a / 4 + 3 * b, [a / 4 + b, a / 2 + 3 * b, 4 * a + b]);
  }
});

// --- Ordinea operațiilor ---
GEN.push({
  id: 'order', tiers: { 3: 2, 4: 2 },
  make(g) {
    const kind = rand(0, 2);
    if (kind === 0) {
      const a = rand(10, g === 3 ? 60 : 300), b = rand(2, 9), c = rand(2, 9);
      return Q('Cât face: ' + a + ' + ' + b + ' × ' + c + ' ?', a + b * c, [(a + b) * c, a + b + c, a * b + c],
        'Întâi înmulțirea, apoi adunarea.');
    }
    if (kind === 1) {
      const b = rand(2, 9), c = rand(2, 9), a = b * c + rand(5, g === 3 ? 50 : 300);
      return Q('Cât face: ' + a + ' − ' + b + ' × ' + c + ' ?', a - b * c, [(a - b) * c, a - b - c, a - b * c + b],
        'Întâi înmulțirea, apoi scăderea.');
    }
    const d = rand(2, 9), q = rand(2, 9), c = d * q, a = rand(3, 9), b = rand(3, 9);
    return Q('Cât face: ' + a + ' × ' + b + ' − ' + c + ' : ' + d + ' ?', a * b - q, [(a * b - c) / d, a * b - c, a * b + q],
      'Întâi înmulțirea și împărțirea, apoi scăderea.');
  }
});

// --- Unități de măsură ---
GEN.push({
  id: 'units', tiers: { 3: 1, 4: 1 },
  make(g) {
    const kind = rand(0, g === 3 ? 2 : 3);
    if (kind === 0) {
      const m = rand(1, 9), cm = rand(5, 95);
      return Q(m + ' m și ' + cm + ' cm = ? cm', m * 100 + cm, [m * 10 + cm, m + cm, m * 1000 + cm], '1 m = 100 cm.');
    }
    if (kind === 1) {
      const h = rand(1, 3), mi = rand(1, 11) * 5;
      return Q(h + (h === 1 ? ' oră' : ' ore') + ' și ' + mi + ' minute = ? minute', h * 60 + mi, [h * 100 + mi, h + mi, h * 60 + mi + 10], '1 oră = 60 de minute.');
    }
    if (kind === 2) {
      const w = rand(2, 9);
      return Q(w + ' săptămâni = ? zile', 7 * w, [5 * w, 7 * w + 7, 10 * w], 'O săptămână are 7 zile.');
    }
    const k = rand(2, 9), gr = rand(1, 9) * 50;
    return Q(k + ' kg și ' + gr + ' g = ? g', k * 1000 + gr, [k * 100 + gr, k + gr, k * 1000 + gr * 10], '1 kg = 1000 g.');
  }
});

// --- Balanța cu fructe ---
GEN.push({
  id: 'balance', tiers: { 0: 3, 1: 3, 2: 3, 3: 3, 4: 3 },
  make(g) {
    if (g >= 3) {
      const a = rand(5, g === 3 ? 30 : 90), b = rand(5, g === 3 ? 30 : 90), c = rand(5, g === 3 ? 30 : 90);
      return Q('🍎 + 🍎 = ' + (2 * a) + ';   🍎 + 🍌 = ' + (a + b) + ';   🍌 + 🍇 = ' + (b + c) + '.   Cât valorează 🍇?',
        c, [b + c, b, a],
        '🍎 = ' + a + ', apoi 🍌 = ' + b + ', deci 🍇 = ' + c + '.');
    }
    let a, b;
    do {
      a = g === 0 ? rand(1, 5) : g === 1 ? rand(3, 20) : rand(10, 90);
      b = g === 0 ? rand(1, 5) : g === 1 ? rand(3, 20) : rand(10, 90);
    } while (a === b);
    const k = g === 2 ? 3 : 2;
    const left = Array(k).fill('🍎').join(' + ');
    return Q(left + ' = ' + (k * a) + ';   🍎 + 🍌 = ' + (a + b) + '.   Cât valorează 🍌?',
      b, [a + b, a, k * a],
      'Un 🍎 valorează ' + a + ', deci 🍌 = ' + (a + b) + ' − ' + a + ' = ' + b + '.');
  }
});

// --- Suma și diferența ---
GEN.push({
  id: 'sumdiff', tiers: { 2: 3, 3: 3, 4: 3 },
  make(g) {
    const x = g === 2 ? rand(5, 40) : g === 3 ? rand(50, 400) : rand(200, 3000);
    const d = g === 2 ? rand(2, 20) : g === 3 ? rand(10, 200) : rand(50, 900);
    const S = 2 * x + d;
    if (g === 2) {
      const f = pick(NAMES_F), m = pick(NAMES_M);
      return Q(f + ' și ' + m + ' au împreună ' + nr(S, 'nuci') + '. ' + f + ' are cu ' + d + ' mai multe decât ' + m + '. Câte nuci are ' + f + '?',
        x + d, [x, S - d, S + d],
        'Scoatem diferența: ' + S + ' − ' + d + ' = ' + (2 * x) + ', jumătate e ' + x + ' (' + m + ').');
    }
    const askBig = Math.random() < 0.5;
    return Q('Suma a două numere este ' + S + ', iar diferența lor este ' + d + '. Care este numărul ' + (askBig ? 'mai mare' : 'mai mic') + '?',
      askBig ? x + d : x, askBig ? [x, S - d, x + 2 * d] : [x + d, S - d, x - d],
      'Numărul mic = (' + S + ' − ' + d + ') : 2 = ' + x + '; numărul mare = ' + (x + d) + '.');
  }
});

// --- Trepte între etaje ---
GEN.push({
  id: 'stairs', tiers: { 2: 3, 3: 3, 4: 3 },
  make(g) {
    const k = g === 2 ? rand(5, 10) : rand(12, 25), m = rand(2, 3), n = rand(m + 2, g === 2 ? 6 : 9);
    return Q('De la parter până la etajul ' + m + ' urci ' + nr(k * m, 'trepte') + '. Câte trepte urci de la parter până la etajul ' + n + '?',
      k * n, [k * (n + 1), k * (n - 1), k * m + n],
      'Între două etaje sunt ' + (k * m) + ' : ' + m + ' = ' + k + ' trepte.');
  }
});

// --- Câte numere de două cifre au suma cifrelor ... ---
GEN.push({
  id: 'digitcount', tiers: { 2: 3, 3: 3, 4: 3 },
  make(g) {
    const s = rand(3, 15);
    const diff = g === 4;
    let cnt = 0;
    for (let t = 1; t <= 9; t++) { const u = s - t; if (u >= 0 && u <= 9 && (!diff || u !== t)) cnt++; }
    return Q('Câte numere de două cifre' + (diff ? ' diferite' : '') + ' au suma cifrelor egală cu ' + s + '?',
      cnt, [cnt + 1, cnt - 1, cnt + 2]);
  }
});

// --- Tăieturi ---
GEN.push({
  id: 'cuts', tiers: { 2: 3, 3: 3, 4: 3 },
  make(g) {
    const n = rand(3, 9), m = rand(2, g === 2 ? 5 : 9);
    return Q('Un buștean este tăiat în ' + n + ' bucăți. O tăietură durează ' + m + ' minute. Câte minute durează toată treaba?',
      (n - 1) * m, [n * m, (n + 1) * m, n - 1],
      'Pentru ' + n + ' bucăți sunt necesare ' + (n - 1) + ' tăieturi.');
  }
});

// --- Pomi pe alee ---
GEN.push({
  id: 'fence', tiers: { 3: 3, 4: 3 },
  make() {
    const d = pick([2, 3, 4, 5, 10]), c = rand(5, 20);
    return Q('Pe o alee lungă de ' + (d * c) + ' m se plantează pomi din ' + d + ' în ' + d + ' metri, inclusiv la ambele capete. Câți pomi se plantează?',
      c + 1, [c, c + 2, c - 1],
      (d * c) + ' : ' + d + ' = ' + c + ' spații, deci ' + (c + 1) + ' pomi.');
  }
});

// --- Perimetru ---
GEN.push({
  id: 'perimeter', tiers: { 3: 3, 4: 3 },
  make(g) {
    if (Math.random() < 0.5) {
      const a = rand(8, g === 3 ? 30 : 90), b = rand(2, a - 3), w = a - b;
      return Q('Un dreptunghi are lungimea de ' + a + ' cm, iar lățimea este cu ' + b + ' cm mai mică. Care este perimetrul lui (în cm)?',
        2 * (a + w), [a + w, 2 * a + w, 2 * (a + b)],
        'Lățimea = ' + w + ' cm. Perimetrul = 2 × (' + a + ' + ' + w + ').');
    }
    const s = rand(3, g === 3 ? 25 : 80);
    return Q('Un pătrat are perimetrul de ' + (4 * s) + ' cm. Cât măsoară latura lui (în cm)?', s, [2 * s, 4 * s - 4, s + 4],
      'Pătratul are 4 laturi egale.');
  }
});

// --- Fracții ---
GEN.push({
  id: 'fraction', tiers: { 3: 3, 4: 3 },
  make(g) {
    const name = pick(NAMES_F);
    if (g === 3) {
      const k = rand(3, 20), N = 4 * k;
      return Q(name + ' are ' + nr(N, 'bomboane') + '. Îi dă fratelui un sfert din ele. Câte bomboane îi rămân?',
        3 * k, [k, 2 * k, N - 4], 'Un sfert din ' + N + ' este ' + k + '.');
    }
    const den = pick([3, 5, 6]), num = rand(2, den - 1), k = rand(4, 30), N = den * k;
    const names = { 3: 'treimi', 5: 'cincimi', 6: 'șesimi' };
    return Q(name + ' are ' + nr(N, 'lei') + ' și cheltuiește ' + num + ' ' + names[den] + ' din bani. Câți lei îi rămân?',
      N - num * k, [num * k, N - k, k], 'O ' + names[den].replace(/i$/, 'e') + ' din ' + N + ' este ' + k + '.');
  }
});

// ================== Testul ==================
export function makeComperTest(grade) {
  if (!isGrade(grade)) return [];
  const used = {};
  return PLAN.map((tier) => {
    let pool = GEN.filter((g) => g.tiers[grade] === tier && !used[g.id]);
    if (!pool.length) pool = GEN.filter((g) => g.tiers[grade] === tier);
    const gen = pick(pool);
    used[gen.id] = true;
    const item = gen.make(grade);
    item.tier = tier;
    item.kind = gen.id;
    return item;
  });
}
