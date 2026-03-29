"use client";

import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

/**
 * Read web SDK config. Returns null if env is incomplete — does not throw
 * (so importing this module never crashes SSR or the first paint).
 */
function readFirebaseOptions(): FirebaseOptions | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

  const missing: string[] = [];
  if (!apiKey) missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!authDomain) missing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  if (!projectId) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (!storageBucket) missing.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  if (!messagingSenderId) missing.push("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
  if (!appId) missing.push("NEXT_PUBLIC_FIREBASE_APP_ID");
  if (missing.length) {
    if (typeof window !== "undefined") {
      console.warn(
        `[firebase] Missing env: ${missing.join(", ")}. ` +
          "Set these in .env.local (local) or in Vercel → Settings → Environment Variables. " +
          "Names must match exactly (NEXT_PUBLIC_…). On Vercel, redeploy after adding them—" +
          "NEXT_PUBLIC_* values are baked in at build time."
      );
    }
    return null;
  }

  const config: FirebaseOptions = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };
  if (measurementId) {
    config.measurementId = measurementId;
  }
  return config;
}

export type ClientFirebase = {
  app: FirebaseApp;
  db: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
};

let cached: ClientFirebase | null | undefined;

function tryInit(): ClientFirebase | null {
  const opts = readFirebaseOptions();
  if (!opts) return null;
  try {
    const app = getApps().length === 0 ? initializeApp(opts) : getApp();
    return {
      app,
      db: getFirestore(app),
      auth: getAuth(app),
      storage: getStorage(app),
    };
  } catch (e) {
    console.error("[firebase] initializeApp / getFirestore failed", e);
    return null;
  }
}

/** Lazy singleton; safe to call from effects. Null if env missing or init failed. */
export function getClientFirebase(): ClientFirebase | null {
  if (cached === undefined) {
    cached = tryInit();
  }
  return cached;
}

export function getDb(): Firestore {
  const c = getClientFirebase();
  if (!c) {
    throw new Error(
      "Firebase is not configured. Set all required NEXT_PUBLIC_FIREBASE_* variables " +
        "(see .env.example). On Vercel: Project → Settings → Environment Variables, " +
        "then trigger a new Production deployment so the client bundle picks them up."
    );
  }
  return c.db;
}

export function getFirebaseAuth(): Auth {
  const c = getClientFirebase();
  if (!c) {
    throw new Error(
      "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* variables (.env.local or Vercel) and redeploy."
    );
  }
  return c.auth;
}

export function getFirebaseStorage(): FirebaseStorage {
  const c = getClientFirebase();
  if (!c) {
    throw new Error(
      "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* variables (.env.local or Vercel) and redeploy."
    );
  }
  return c.storage;
}

export function getFirebaseApp(): FirebaseApp {
  const c = getClientFirebase();
  if (!c) {
    throw new Error(
      "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* variables (.env.local or Vercel) and redeploy."
    );
  }
  return c.app;
}
