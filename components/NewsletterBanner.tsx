"use client";

import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getClientFirebase } from "@/app/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function NewsletterBanner() {
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

  return (
    <section
      className="border-t border-border bg-muted/40 py-10"
      aria-label="Newsletter"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">
            Join the list
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
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
            className="bg-background"
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
