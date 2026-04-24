"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileNav } from "@/components/MobileNav";
import { NewsletterBanner } from "@/components/NewsletterBanner";

/**
 * Wraps page content with the store header, footer, mobile nav, newsletter.
 * On /admin/* routes the store chrome is hidden — only children render.
 */
export function StoreChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) return <>{children}</>;

  return (
    <>
      <Header />
      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>
      <NewsletterBanner />
      <Footer />
      <MobileNav />
    </>
  );
}
