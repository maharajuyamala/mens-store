"use client";

import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getClientFirebase } from "@/app/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type NewsletterTone = "default" | "dark";

export function NewsletterBanner({ tone = "default" }: { tone?: NewsletterTone }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setPending(true);
    try {
      const fb = getClientFirebase();
      if (!fb) {
        toast.error("Newsletter unavailable", {
          description: "Firebase is not configured on this device.",
        });
        return;
      }
      await addDoc(collection(fb.db, "newsletter_subscribers"), {
        email: trimmed,
        source: "site_banner",
        createdAt: serverTimestamp(),
      });
      toast.success("You’re on the list", {
        description: "Thanks for subscribing.",
      });
      setEmail("");
    } catch {
      toast.error("Couldn’t subscribe", {
        description: "Check your connection or try again later.",
      });
    } finally {
      setPending(false);
    }
  };

  const isDark = tone === "dark";

  return (
    <section
      className={cn(
        "border-t py-12 sm:py-14",
        isDark
          ? "border-white/10 bg-gradient-to-b from-zinc-900/90 to-zinc-950"
          : "border-border bg-muted/40"
      )}
      aria-label="Newsletter"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="space-y-2">
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-[0.2em]",
              isDark ? "text-orange-400/90" : "text-orange-600"
            )}
          >
            Stay ahead
          </p>
          <h2
            className={cn(
              "text-xl font-semibold tracking-tight sm:text-2xl",
              isDark ? "text-white" : "text-foreground"
            )}
          >
            Join the list
          </h2>
          <p
            className={cn(
              "max-w-md text-sm",
              isDark ? "text-zinc-400" : "text-muted-foreground"
            )}
          >
            New drops and private sales — no spam.
          </p>
        </div>
        <form
          onSubmit={(e) => void submit(e)}
          className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:items-center"
        >
          <Input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(
              isDark &&
                "border-white/15 bg-white/5 text-white placeholder:text-zinc-500 focus-visible:ring-orange-500/40"
            )}
            disabled={pending}
          />
          <Button
            type="submit"
            className="shrink-0 bg-orange-600 hover:bg-orange-500"
            disabled={pending}
          >
            {pending ? "…" : "Subscribe"}
          </Button>
        </form>
      </div>
    </section>
  );
}
