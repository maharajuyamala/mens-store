"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          backgroundColor: "#0a0a0a",
          color: "#fafafa",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 420, width: "100%" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: 9999,
              backgroundColor: "rgba(249, 115, 22, 0.15)",
              marginBottom: 16,
              fontSize: 28,
              color: "#f97316",
            }}
            aria-hidden
          >
            !
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 600,
              margin: "0 0 8px",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#a3a3a3",
              margin: "0 0 20px",
              lineHeight: 1.5,
            }}
          >
            We hit an unexpected error. Please reload — if it keeps happening,
            try again in a moment.
          </p>
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                appearance: "none",
                border: 0,
                backgroundColor: "#f97316",
                color: "white",
                fontWeight: 600,
                fontSize: 14,
                padding: "10px 18px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/";
                }
              }}
              style={{
                appearance: "none",
                border: "1px solid #404040",
                backgroundColor: "transparent",
                color: "#fafafa",
                fontWeight: 600,
                fontSize: 14,
                padding: "10px 18px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Go home
            </button>
          </div>
          {error.digest ? (
            <p
              style={{
                fontSize: 11,
                color: "#525252",
                marginTop: 20,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
              }}
            >
              Ref: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
