import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Firebase Admin SDK init. Reads credentials from FIREBASE_SERVICE_ACCOUNT_JSON
 * (the full JSON downloaded from Firebase Console → Project settings → Service
 * accounts → Generate new private key). Single inline env var avoids file paths
 * in serverless. Returns null if not configured so callers can fall back.
 */

let cachedApp: App | null | undefined;

function tryInitAdmin(): App | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.warn(
      "[firebase-admin] FIREBASE_SERVICE_ACCOUNT_JSON is not set. " +
        "Server-side order placement and admin endpoints will be disabled."
    );
    return null;
  }
  try {
    const json = JSON.parse(raw) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    if (!json.project_id || !json.client_email || !json.private_key) {
      throw new Error("Service account JSON missing required fields");
    }
    if (getApps().length > 0) return getApp();
    return initializeApp({
      credential: cert({
        projectId: json.project_id,
        clientEmail: json.client_email,
        // Newlines in the env var typically come through as literal \n.
        privateKey: json.private_key.replace(/\\n/g, "\n"),
      }),
    });
  } catch (e) {
    console.error("[firebase-admin] init failed", e);
    return null;
  }
}

export function getAdminApp(): App | null {
  if (cachedApp === undefined) {
    cachedApp = tryInitAdmin();
  }
  return cachedApp;
}

export function getAdminFirestore(): Firestore | null {
  const app = getAdminApp();
  return app ? getFirestore(app) : null;
}

export function getAdminAuth(): Auth | null {
  const app = getAdminApp();
  return app ? getAuth(app) : null;
}

/** Throwing variants for routes that genuinely cannot proceed without admin. */
export class AdminNotConfiguredError extends Error {
  constructor() {
    super(
      "Server-side admin SDK is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON."
    );
    this.name = "AdminNotConfiguredError";
  }
}

export function requireAdminFirestore(): Firestore {
  const db = getAdminFirestore();
  if (!db) throw new AdminNotConfiguredError();
  return db;
}

export function requireAdminAuth(): Auth {
  const auth = getAdminAuth();
  if (!auth) throw new AdminNotConfiguredError();
  return auth;
}
