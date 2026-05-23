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
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { getClientFirebase, getDb, getFirebaseAuth } from "@/app/firebase";
import { AuthContext, type UserProfile } from "@/hooks/useAuth";
import { revalidateCart } from "@/lib/checkout/revalidate-cart";
import { useCartStore } from "@/store/cartStore";
import {
  mergeWishlistOnSignIn,
  writeRemoteWishlist,
} from "@/lib/wishlist/sync";
import { useWishlistStore } from "@/store/wishlistStore";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const profileBackfillAttempted = useRef(new Set<string>());
  const cartRevalidatedRef = useRef(false);

  // Once per app load, scrub the persisted cart against current product state
  // (archived / out-of-stock / over-quantity items). Best-effort; failures are silent.
  useEffect(() => {
    if (cartRevalidatedRef.current) return;
    cartRevalidatedRef.current = true;
    const items = useCartStore.getState().items;
    if (items.length === 0) return;

    void (async () => {
      try {
        const { changes, nextItems } = await revalidateCart(items);
        if (changes.length === 0) return;
        useCartStore.setState({ items: nextItems });
        const removed = changes.filter((c) => c.type === "removed").length;
        const clamped = changes.filter((c) => c.type === "clamped").length;
        const parts: string[] = [];
        if (removed > 0) parts.push(`${removed} removed`);
        if (clamped > 0) parts.push(`${clamped} quantity adjusted`);
        toast.warning("We updated your cart", {
          description: `${parts.join(" · ")} based on current stock.`,
        });
      } catch {
        // Network or rules problems — don't block the user; checkout will catch real issues.
      }
    })();
  }, []);

  // Wishlist sync: on sign-in, merge local + remote into the local store. Then
  // subscribe so subsequent local edits write through to Firestore.
  useEffect(() => {
    if (!user?.uid) return;
    let alive = true;
    let unsubscribeStore: (() => void) | null = null;

    void (async () => {
      const localIds = useWishlistStore.getState().ids;
      const merged = await mergeWishlistOnSignIn(user.uid, localIds);
      if (!alive) return;
      // Avoid an extra remote write if nothing changed.
      if (merged.join("|") !== localIds.join("|")) {
        useWishlistStore.setState({ ids: merged });
      }
      // Then subscribe to local edits and write through. Debounce-light: only fire
      // when ids actually change (Zustand subscribe receives prev/next).
      unsubscribeStore = useWishlistStore.subscribe((state, prev) => {
        if (state.ids === prev.ids) return;
        void writeRemoteWishlist(user.uid, state.ids);
      });
    })();

    return () => {
      alive = false;
      if (unsubscribeStore) unsubscribeStore();
    };
  }, [user?.uid]);

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
      // Cookie consumed by middleware.ts to gate /admin/* at the edge.
      // Lax / 30-day; no security claim here — Firestore rules + AdminGuard do real auth.
      if (typeof document !== "undefined") {
        if (u) {
          const secure =
            typeof window !== "undefined" &&
            window.location.protocol === "https:"
              ? "; Secure"
              : "";
          document.cookie = `mens-store-signed-in=1; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`;
        } else {
          document.cookie =
            "mens-store-signed-in=; Path=/; Max-Age=0; SameSite=Lax";
        }
      }
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
      // Best-effort: don't block signup on email delivery.
      try {
        await sendEmailVerification(cred.user);
      } catch (err) {
        console.warn("[auth] sendEmailVerification failed", err);
      }
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

  const sendPasswordReset = useCallback(async (email: string) => {
    await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    const current = getFirebaseAuth().currentUser;
    if (!current) throw new Error("Not signed in");
    if (current.emailVerified) return;
    await sendEmailVerification(current);
  }, []);

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
      sendPasswordReset,
      resendVerificationEmail,
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
      sendPasswordReset,
      resendVerificationEmail,
    ]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
