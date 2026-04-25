import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { AuthProvider } from "@/components/AuthProvider";
import { StoreChrome } from "@/components/StoreChrome";
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
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh bg-background text-foreground antialiased`}
      >
        <AuthProvider>
          <SearchDialogProvider>
            <StoreChrome>
              <Suspense
              fallback={
                <div className="flex min-h-[40vh] items-center justify-center bg-background text-sm text-muted-foreground">
                  Loading…
                </div>
              }
            >
              {children}
            </Suspense>
            </StoreChrome>
            <GlobalSearchCommand />
            <Toaster richColors closeButton position="top-center" />
          </SearchDialogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
