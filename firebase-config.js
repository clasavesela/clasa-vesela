// =====================================================================
//  CONFIGURARE FIREBASE
//  1) Firebase Console → Project settings → General → „Your apps” → Web app
//     Copiază obiectul firebaseConfig și înlocuiește valorile de mai jos.
//     (Cheia apiKey NU e o parolă – e făcută să fie publică. Securitatea
//      vine din regulile din fișierul firestore.rules.)
//  2) ADMIN_UID = UID-ul contului tău de administrator
//     (Firebase Console → Authentication → Users → coloana „User UID”).
//     Același UID trebuie pus și în firestore.rules.
// =====================================================================

export const firebaseConfig = {
  apiKey: 'AIzaSyDqrl8dm0N0bMZ4DWMztrPRtRSfbIbWbxU',
  authDomain: 'matematica-vesela.firebaseapp.com',
  projectId: 'matematica-vesela',
  storageBucket: 'matematica-vesela.firebasestorage.app',
  messagingSenderId: '232041495756',
  appId: '1:232041495756:web:143bff82e164617d62d669'
};

export const ADMIN_UID = 'h57UZDmgtMYmOu9CJG3CSZP2qeU2';
