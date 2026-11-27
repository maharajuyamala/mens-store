import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { AuthProvider } from "@/components/AuthProvider";
import { ChunkErrorReloader } from "@/components/ChunkErrorReloader";
import { StoreChrome } from "@/components/StoreChrome";
import { GlobalSearchCommand } from "@/components/search/GlobalSearchCommand";
import { SearchDialogProvider } from "@/components/search/SearchDialogContext";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var p="system";try{var s=localStorage.getItem("secondskin-theme");if(s==="light"||s==="dark"||s==="system")p=s;}catch(e){}var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";})()` }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh bg-background text-foreground antialiased`}
      >
        <ChunkErrorReloader />
        <ThemeProvider>
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
        </ThemeProvider>
      </body>
    </html>
  );
}
