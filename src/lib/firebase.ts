import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseAppletConfig from '@/firebase-applet-config.json';

const envFirebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

const envFirestoreDatabaseId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;

const hasCompleteEnvConfig = Boolean(
  envFirebaseConfig.projectId &&
    envFirebaseConfig.appId &&
    envFirebaseConfig.apiKey &&
    envFirebaseConfig.authDomain &&
    envFirebaseConfig.storageBucket &&
    envFirebaseConfig.messagingSenderId &&
    envFirestoreDatabaseId,
);

const firebaseConfig = hasCompleteEnvConfig
  ? envFirebaseConfig
  : {
      projectId: firebaseAppletConfig.projectId,
      appId: firebaseAppletConfig.appId,
      apiKey: firebaseAppletConfig.apiKey,
      authDomain: firebaseAppletConfig.authDomain,
      storageBucket: firebaseAppletConfig.storageBucket,
      messagingSenderId: firebaseAppletConfig.messagingSenderId,
      measurementId: firebaseAppletConfig.measurementId || undefined,
    };

const firestoreDatabaseId = hasCompleteEnvConfig
  ? envFirestoreDatabaseId
  : firebaseAppletConfig.firestoreDatabaseId;

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firestoreDatabaseId);
export const storage = getStorage(app);

// Secondary app for creating users without signing out the current admin
const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
export const secondaryAuth = getAuth(secondaryApp);
