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
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#013644",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 24 }}>Admin crashed</h2>
        <p
          style={{
            margin: 0,
            maxWidth: 480,
            textAlign: "center",
            color: "rgba(255,255,255,0.65)",
            fontSize: 14,
          }}
        >
          {error.message || "Unexpected application error."}
        </p>
        {error.digest ? (
          <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
            Digest: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => reset()}
          style={{
            cursor: "pointer",
            border: 0,
            borderRadius: 8,
            padding: "10px 16px",
            background: "#98E32F",
            color: "#013644",
            fontWeight: 700,
          }}
        >
          Try again
        </button>
        <a href="/login" style={{ color: "#98E32F", fontSize: 14 }}>
          Go to login
        </a>
      </body>
    </html>
  );
}
