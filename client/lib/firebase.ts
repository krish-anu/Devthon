// Firebase initialization helper (TypeScript)
// Use client-safe environment variables (NEXT_PUBLIC_FIREBASE_*). Do not include server service account keys here.

import { initializeApp, getApps, getApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

function initFirebase(): FirebaseApp | null {
  if (!firebaseConfig.apiKey) {
    // eslint-disable-next-line no-console
    console.warn('Missing NEXT_PUBLIC_FIREBASE_API_KEY. Firebase will not be initialized.');
    return null;
  }

  if (!getApps().length) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
}

const firebaseApp = initFirebase();

export const auth = firebaseApp && typeof window !== 'undefined' ? getAuth(firebaseApp) : undefined;
export const db = firebaseApp && typeof window !== 'undefined' ? getFirestore(firebaseApp) : undefined;
export const storage = firebaseApp && typeof window !== 'undefined' ? getStorage(firebaseApp) : undefined;

// Analytics is optional and must run in browser environment where 'window' is available
export let analytics: ReturnType<typeof getAnalytics> | undefined;

if (firebaseApp && typeof window !== 'undefined' && firebaseConfig.measurementId) {
  (async () => {
    if (await isSupported()) {
      analytics = getAnalytics(firebaseApp);
    }
  })();
}

export default firebaseApp;
