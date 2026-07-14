"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function safeNextPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

function GoogleGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.28 1.48-1.12 2.73-2.39 3.57v2.97h3.86c2.26-2.09 3.58-5.17 3.58-8.78z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.92l-3.86-2.97c-1.07.72-2.44 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.97H1.28v3.07C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.25 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.64H1.28C.46 8.26 0 10.08 0 12s.46 3.74 1.28 5.36l3.97-3.07z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.28 6.64l3.97 3.07C6.2 6.87 8.86 4.75 12 4.75z"
      />
    </svg>
  );
}

function SignInPageInner() {
  const { user, loading, signIn, signInWithGoogle } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const afterLoginPath = safeNextPath(searchParams.get("next")) ?? "/";
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace(afterLoginPath);
    }
  }, [loading, user, router, afterLoginPath]);

  const handleEmailSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter email and password.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.replace(afterLoginPath);
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace(afterLoginPath);
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  if (loading || user) {
    return <SignInFallback />;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-950 px-4 py-16 text-white">
      {/* Soft ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-orange-500/20 blur-[140px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 right-8 h-[320px] w-[320px] rounded-full bg-orange-600/10 blur-[120px]"
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm"
      >
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-[0_20px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <div className="flex flex-col items-center text-center">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-700 text-lg font-bold tracking-tight text-white shadow-lg shadow-orange-900/40">
              S
            </span>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-neutral-400">
              Sign in to continue to Second Skin
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={submitting || googleLoading}
              className="group relative flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white text-[15px] font-medium text-neutral-900 shadow-sm transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {googleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
              ) : (
                <GoogleGlyph />
              )}
              <span>
                {googleLoading ? "Connecting…" : "Continue with Google"}
              </span>
            </button>

            {!showEmailForm ? (
              <button
                type="button"
                onClick={() => setShowEmailForm(true)}
                disabled={submitting || googleLoading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] text-sm font-medium text-neutral-300 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Mail className="h-4 w-4" />
                Continue with email
              </button>
            ) : null}
          </div>

          {showEmailForm ? (
            <motion.form
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleEmailSignIn}
              className="mt-6 space-y-4"
            >
              <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                <span className="h-px flex-1 bg-white/10" />
                <span>or with email</span>
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="signin-email"
                  className="text-xs font-medium text-neutral-400"
                >
                  Email
                </Label>
                <Input
                  id="signin-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-neutral-500 focus-visible:ring-orange-500/40"
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="signin-password"
                    className="text-xs font-medium text-neutral-400"
                  >
                    Password
                  </Label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs text-neutral-400 transition-colors hover:text-orange-400"
                  >
                    Forgot?
                  </Link>
                </div>
                <Input
                  id="signin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-neutral-500 focus-visible:ring-orange-500/40"
                  placeholder="••••••••"
                />
              </div>

              {error ? (
                <p
                  role="alert"
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
                >
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={submitting || googleLoading}
                className="h-11 w-full rounded-xl bg-orange-600 text-[15px] font-medium text-white shadow-md shadow-orange-900/30 transition-colors hover:bg-orange-500 disabled:opacity-70"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Sign in"
                )}
              </Button>
            </motion.form>
          ) : error ? (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            >
              {error}
            </p>
          ) : null}

          <p className="mt-8 text-center text-sm text-neutral-400">
            New to Second Skin?{" "}
            <Link
              href="/auth/sign-up"
              className="font-medium text-orange-400 transition-colors hover:text-orange-300"
            >
              Create an account
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-500">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-neutral-300">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-neutral-300">
            Privacy Policy
          </Link>
          .
        </p>
      </motion.div>
    </div>
  );
}

function SignInFallback() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-950 px-4 py-16 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-orange-500/20 blur-[140px]"
      />
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInPageInner />
    </Suspense>
  );
}
