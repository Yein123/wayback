// Firebase for this phone: anonymous sign-in (so records are private to this browser) and
// Firestore with an offline cache (saves still work with a weak signal and sync later).
import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let started: Promise<{ db: Firestore; user: User }> | null = null;

/** Signs in (once) and returns Firestore plus this browser's anonymous user. */
export function firebase(): Promise<{ db: Firestore; user: User }> {
  started ??= (async () => {
    if (!config.apiKey || !config.projectId) throw new Error("Firebase isn't set up: copy .env.local.example to .env.local and fill it in.");
    const app = getApps()[0] ?? initializeApp(config);
    const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
    const auth = getAuth(app);
    // The browser remembers the anonymous user, so wait for it before making a new one.
    const existing = await new Promise<User | null>((resolve) => {
      const stop = onAuthStateChanged(auth, (u) => {
        stop();
        resolve(u);
      });
    });
    const user = existing ?? (await signInAnonymously(auth)).user;
    return { db, user };
  })();
  started.catch(() => {
    started = null; // let a later call retry (e.g. after coming back online)
  });
  return started;
}
