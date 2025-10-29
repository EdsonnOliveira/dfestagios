import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDscTHd8mvrq--M_QcPBCAxSJR8hN14gEA',
  authDomain: 'estagiosdf-84d0a.firebaseapp.com',
  projectId: 'estagiosdf-84d0a',
  storageBucket: 'estagiosdf-84d0a.firebasestorage.app',
  messagingSenderId: '381813886982',
  appId: '1:381813886982:web:f6fe1f11a14e9875097387',
  measurementId: 'G-5SPQJCF0E8'
};

const app = initializeApp(firebaseConfig);

export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
