"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { getClientFirebase, getDb, getFirebaseAuth } from "@/app/firebase";
import { AuthContext, type UserProfile } from "@/hooks/useAuth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const profileBackfillAttempted = useRef(new Set<string>());

  useEffect(() => {
    const fb = getClientFirebase();
    if (!fb) {
      setAuthReady(true);
      setProfileReady(true);
      return;
    }
    const unsub = onAuthStateChanged(fb.auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        profileBackfillAttempted.current.clear();
        setProfile(null);
        setProfileReady(true);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }
    const fb = getClientFirebase();
    if (!fb) {
      setProfileReady(true);
      return;
    }
    // Avoid showing the previous user's profile while the new uid loads.
    setProfile(null);
    setProfileReady(false);
    const ref = doc(fb.db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        } else {
          setProfile(null);
        }
        setProfileReady(true);
      },
      () => {
        setProfile(null);
        setProfileReady(true);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  /**
   * Create users/{uid} only when the document truly does not exist.
   * Never call setDoc blindly when profile is null — that overwrote admin (and
   * any custom role) after listener errors or cache races.
   */
  useEffect(() => {
    if (!user || !profileReady || profile !== null) return;
    if (profileBackfillAttempted.current.has(user.uid)) return;
    profileBackfillAttempted.current.add(user.uid);
    const fb = getClientFirebase();
    if (!fb) return;
    const ref = doc(fb.db, "users", user.uid);
    void (async () => {
      try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
          return;
        }
        await setDoc(ref, {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL ?? null,
          role: "user",
          createdAt: serverTimestamp(),
        });
      } catch {
        profileBackfillAttempted.current.delete(user.uid);
      }
    })();
  }, [user, profile, profileReady]);

  const loading = !authReady || (user !== null && !profileReady);
  const isAdmin = profile?.role === "admin";

  const ensureUserProfile = useCallback(async (u: User) => {
    const ref = doc(getDb(), "users", u.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return;
    await setDoc(ref, {
      email: u.email,
      displayName: u.displayName,
      photoURL: u.photoURL ?? null,
      role: "user",
      createdAt: serverTimestamp(),
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const cred = await createUserWithEmailAndPassword(
        getFirebaseAuth(),
        email.trim(),
        password
      );
      await setDoc(doc(getDb(), "users", cred.user.uid), {
        email: cred.user.email,
        displayName: displayName?.trim() || null,
        photoURL: null,
        role: "user",
        createdAt: serverTimestamp(),
      });
    },
    []
  );

  const signOut = useCallback(async () => {
    await firebaseSignOut(getFirebaseAuth());
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(getFirebaseAuth(), provider);
    await ensureUserProfile(cred.user);
  }, [ensureUserProfile]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isAdmin,
      signIn,
      signUp,
      signOut,
      signInWithGoogle,
    }),
    [
      user,
      profile,
      loading,
      isAdmin,
      signIn,
      signUp,
      signOut,
      signInWithGoogle,
    ]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
