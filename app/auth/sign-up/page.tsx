"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function SignUpPage() {
  const { user, loading, signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter email and password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await signUp(email, password, displayName);
      router.replace("/");
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
      router.replace("/");
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  if (loading || user) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-12 w-full rounded-xl bg-muted" />
          <Skeleton className="h-56 w-full rounded-xl bg-muted" />
          <Skeleton className="h-10 w-full rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 pt-24 pb-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <Card className="border-border bg-card text-foreground shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-foreground">Create account</CardTitle>
            <CardDescription className="text-muted-foreground">
              Join SecondSkin with email or Google.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full border-border bg-background text-foreground hover:bg-muted hover:text-foreground"
              onClick={handleGoogle}
              disabled={submitting || googleLoading}
            >
              {googleLoading ? "Connecting…" : "Sign up with Google"}
            </Button>
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name" className="text-foreground">
                  Name <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground"
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-foreground">
                  Email
                </Label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground"
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-foreground">
                  Password
                </Label>
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground"
                  placeholder="At least 6 characters"
                />
              </div>
              {error ? (
                <p className="text-sm text-red-400" role="alert">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={submitting || googleLoading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary-hover"
              >
                {submitting ? (
                  "Creating account…"
                ) : (
                  <>
                    Sign up <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 border-t border-border pt-6">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/auth/sign-in"
                className="font-medium text-brand hover:underline"
              >
                Sign in
              </Link>
            </p>
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to home
            </Link>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
