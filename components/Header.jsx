"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Menu, X, ArrowRight } from "lucide-react";
import Link from "next/link";
import { AddItemDialog } from "./AddDialogue";

import { auth } from "../app/firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";

const TOKEN_KEY = "ss_id_token";

// Decode a base64url JWT payload safely
function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const [user, setUser] = useState(null);          // Firebase user (if loaded)
  const [emailFromToken, setEmailFromToken] = useState(null); // Email from stored token

  const displayEmail = (user && user.email) || emailFromToken;
  const isSignedIn = !!displayEmail;

  // Header scroll style
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock page scroll when overlays are open
  useEffect(() => {
    const shouldLock = isMenuOpen || isLoginOpen;
    document.body.style.overflow = shouldLock ? "hidden" : "auto";
    return () => { document.body.style.overflow = "auto"; };
  }, [isMenuOpen, isLoginOpen]);

  // On first load, restore token (if valid) and show email immediately
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (token) {
      const payload = parseJwt(token);
      const notExpired = payload?.exp && payload.exp * 1000 > Date.now();
      if (notExpired) {
        setEmailFromToken(payload?.email || null);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
  }, []);

  // Keep token in sync with Firebase auth and refreshes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const token = await u.getIdToken(); // refreshed automatically by Firebase
          localStorage.setItem(TOKEN_KEY, token);
          const payload = parseJwt(token);
          setEmailFromToken(payload?.email || u.email || null);
        } catch {
          // If something went wrong, fall back to user.email
          setEmailFromToken(u.email || null);
        }
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setEmailFromToken(null);
      }
    });
    return () => unsub();
  }, []);

  const navLinks = [
    { label: "Home", link: "/" },
    { label: "Shop", link: "/explore" },
    { label: "Collections", link: "/" },
    { label: "Contact", link: "/" },
  ];

  const menuVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } },
  };
  const linkVariants = { hidden: { opacity: 0, y: -10 }, visible: { opacity: 1, y: 0 } };

  return (
    <>
      <motion.header
        initial={false}
        animate={{
          backgroundColor: isScrolled ? "rgba(10,10,10,0.8)" : "rgba(10,10,10,0)",
          backdropFilter: isScrolled ? "blur(10px)" : "blur(0px)",
          boxShadow: isScrolled ? "0 4px 30px rgba(0,0,0,0.1)" : "none",
        }}
        transition={{ duration: 0.3 }}
        className="fixed top-0 left-0 w-[100svw] text-white px-4 sm:px-8 py-4 flex items-center justify-between z-50 overflow-x-hidden"
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-white text-2xl font-bold tracking-wider">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-orange-500" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M2 7L12 12L22 7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M12 12V22" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          SecondSkin
        </Link>

        {/* Desktop Nav */}
        <motion.nav variants={menuVariants} initial="hidden" animate="visible" className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
          {navLinks.map((link) => (
            <motion.a key={link.label} href={link.link} variants={linkVariants} className="relative group">
              {link.label}
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-orange-500 group-hover:w-full transition-all duration-300" />
            </motion.a>
          ))}
        </motion.nav>

        {/* Right side */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Cart */}
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            className="relative bg-transparent border border-gray-600 hover:border-orange-500 rounded-full p-2.5 transition-colors duration-300">
            <ShoppingCart className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-500 text-white text-[10px] leading-none items-center justify-center">3</span>
            </span>
          </motion.button>

          {user&&<AddItemDialog />}

          {/* Email (from token or user) */}
          {isSignedIn && (
            <span
              className="hidden md:block max-w-[180px] truncate text-xs text-gray-300"
              title={displayEmail}
            >
              {displayEmail}
            </span>
          )}

          {/* Auth buttons */}
          {!isSignedIn ? (
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setIsLoginOpen(true)}
              className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-600 hover:border-orange-500 text-sm text-gray-200"
            >
              Sign in <ArrowRight className="h-4 w-4" />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={async () => {
                try { await signOut(auth); } finally {
                  localStorage.removeItem(TOKEN_KEY);
                  setEmailFromToken(null);
                }
              }}
              className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-600 hover:border-orange-500 text-sm text-gray-200"
            >
              Logout
            </motion.button>
          )}

          {/* Mobile menu button */}
          <div className="md:hidden">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setIsMenuOpen(true)} className="text-white">
              <Menu className="h-7 w-7" />
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm z-50 md:hidden"
            onClick={() => setIsMenuOpen(false)}
          >
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute top-0 right-0 h-full w-[80vw] max-w-sm bg-gray-900 p-8 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setIsMenuOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white">
                <X className="h-7 w-7" />
              </button>
              <nav className="flex flex-col gap-8 mt-16 text-lg">
                {navLinks.map((link) => (
                  <a key={link.label} href={link.link} className="text-gray-200 hover:text-orange-500 transition-colors" onClick={() => setIsMenuOpen(false)}>
                    {link.label}
                  </a>
                ))}
                {!isSignedIn ? (
                  <button onClick={() => { setIsMenuOpen(false); setIsLoginOpen(true); }} className="mt-4 text-left text-gray-200 hover:text-orange-500">
                    Sign in
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      try { await signOut(auth); } finally {
                        localStorage.removeItem(TOKEN_KEY);
                        setEmailFromToken(null);
                        setIsMenuOpen(false);
                      }
                    }}
                    className="mt-4 text-left text-gray-200 hover:text-orange-500"
                  >
                    Logout
                  </button>
                )}
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <LoginDialog
        open={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={(email) => {
          setEmailFromToken(email); // already set via auth listener, but ensures instant UI
          setIsLoginOpen(false);
        }}
      />
    </>
  );
};

/* -------------------------- Login Dialog -------------------------- */
const LoginDialog = ({ open, onClose, onSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) { setErr("Please enter email and password."); return; }
    setErr(null);
    setSubmitting(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      // Save token immediately
      const token = await cred.user.getIdToken();
      localStorage.setItem("ss_id_token", token);
      const payload = parseJwt(token);
      onSuccess && onSuccess(payload?.email || cred.user.email || "");
      setEmail(""); setPassword("");
    } catch (error) {
      const code = error?.code;
      const msg =
        code === "auth/invalid-credential" ? "Invalid email or password." :
        code === "auth/user-disabled" ? "This account is disabled." :
        code === "auth/too-many-requests" ? "Too many attempts. Try again later." :
        error?.message || "Sign in failed. Please try again.";
      setErr(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-700 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Sign in</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Email</label>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-gray-100 outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Password</label>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-gray-100 outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="••••••••"
                />
              </div>

              {err && <div className="text-sm text-red-400">{err}</div>}

              <motion.button
                whileHover={{ scale: submitting ? 1 : 1.02 }}
                whileTap={{ scale: submitting ? 1 : 0.98 }}
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-60 px-4 py-2.5 text-white font-medium transition-colors"
              >
                {submitting ? "Signing in…" : "Sign in"}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </motion.button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
