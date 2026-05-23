"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, MailCheck } from "lucide-react";
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

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 pt-24 pb-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <Card className="border-gray-800 bg-gray-900 text-white shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-white">
              Reset password
            </CardTitle>
            <CardDescription className="text-gray-400">
              Enter the email you used to sign up. We&apos;ll send you a link to
              set a new password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sent ? (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                <div className="flex items-start gap-3">
                  <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                  <div>
                    <p className="font-medium">Check your inbox.</p>
                    <p className="mt-1 text-emerald-200/80">
                      If <span className="font-mono">{email}</span> matches an
                      account, you&apos;ll receive a reset link shortly. Check
                      spam if you don&apos;t see it.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email" className="text-gray-300">
                    Email
                  </Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-gray-700 bg-gray-950 text-white placeholder:text-gray-500"
                    placeholder="you@example.com"
                  />
                </div>
                {error ? (
                  <p className="text-sm text-red-400" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-orange-600 text-white hover:bg-orange-500"
                >
                  {submitting ? (
                    "Sending…"
                  ) : (
                    <>
                      Send reset link <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-2 border-t border-gray-800 pt-6">
            <p className="text-sm text-gray-400">
              Remembered it?{" "}
              <Link
                href="/auth/sign-in"
                className="font-medium text-orange-400 hover:underline"
              >
                Sign in
              </Link>
            </p>
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-gray-300"
            >
              ← Back to home
            </Link>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
