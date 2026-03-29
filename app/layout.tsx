import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { AuthProvider } from "@/components/AuthProvider";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MobileNav } from "@/components/MobileNav";
import { NewsletterBanner } from "@/components/NewsletterBanner";
import { GlobalSearchCommand } from "@/components/search/GlobalSearchCommand";
import { SearchDialogProvider } from "@/components/search/SearchDialogContext";
import { Toaster } from "@/components/ui/sonner";
import { siteBaseUrl } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteBaseUrl()),
  title: {
    default: "SecondSkin — Curated menswear",
    template: "%s | SecondSkin",
  },
  description:
    "Premium shirts, pants, jackets, and accessories — contemporary design and craftsmanship.",
  openGraph: {
    type: "website",
    siteName: "SecondSkin",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <SearchDialogProvider>
            <Header />
            <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
              <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
            </div>
            <NewsletterBanner />
            <Footer />
            <MobileNav />
            <GlobalSearchCommand />
            <Toaster richColors closeButton position="top-center" />
          </SearchDialogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
