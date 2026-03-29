import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * Firestore for Next.js server (RSC, sitemap, metadata). Uses the same web config as the client.
 * Returns null when env is incomplete (e.g. CI build without secrets).
 */
export function getServerFirestore(): Firestore | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) return null;

  try {
    const config: FirebaseOptions = {
      apiKey,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
      projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
      messagingSenderId:
        process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    };
    const app = getApps().length > 0 ? getApp() : initializeApp(config);
    return getFirestore(app);
  } catch (e) {
    console.error("[getServerFirestore]", e);
    return null;
  }
}
