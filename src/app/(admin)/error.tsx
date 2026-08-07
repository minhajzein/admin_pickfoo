"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#013644] px-6 text-white">
      <h2 className="text-2xl font-bold">Something went wrong</h2>
      <p className="max-w-lg text-center text-sm text-white/60">
        {error.message || "An unexpected error occurred in the admin console."}
      </p>
      {error.digest ? (
        <p className="text-xs text-white/35">Digest: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="bg-[#98E32F] text-[#013644] hover:brightness-110"
          onClick={() => reset()}
        >
          Try again
        </Button>
        <Button
          asChild
          type="button"
          variant="outline"
          className="border-white/15 text-white"
        >
          <Link href="/">Go to dashboard</Link>
        </Button>
        <Button
          asChild
          type="button"
          variant="outline"
          className="border-white/15 text-white"
        >
          <Link href="/login">Login</Link>
        </Button>
      </div>
    </div>
  );
}
