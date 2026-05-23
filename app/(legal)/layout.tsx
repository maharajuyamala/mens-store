import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-4 py-24 pb-16 prose prose-neutral dark:prose-invert prose-headings:tracking-tight prose-p:leading-relaxed">
      {children}
    </article>
  );
}
