// Încarcă Firebase doar când e nevoie (modul „exersez singur” merge și fără).
import { firebaseConfig } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

export const isConfigured = Boolean(
  firebaseConfig && firebaseConfig.apiKey && !/^PUNE/.test(firebaseConfig.apiKey)
);

const cache = {};

// appName separă sesiunile: copiii (anonim) nu „dau afară” contul de profesor
// deschis în același browser, și invers.
export function fb(appName) {
  const key = appName || '[DEFAULT]';
  if (!cache[key]) {
    cache[key] = (async () => {
      const [appMod, authMod, fsMod] = await Promise.all([
        import(SDK + 'firebase-app.js'),
        import(SDK + 'firebase-auth.js'),
        import(SDK + 'firebase-firestore.js')
      ]);
      const app = appName
        ? appMod.initializeApp(firebaseConfig, appName)
        : appMod.initializeApp(firebaseConfig);
      const auth = authMod.getAuth(app);
      const db = fsMod.getFirestore(app);
      return { appMod, authMod, fsMod, app, auth, db };
    })().catch((e) => {
      delete cache[key];
      throw e;
    });
  }
  return cache[key];
}
