"use client";

import NextImage, { type ImageProps } from "next/image";

/** Drop AWS/CloudFront signature query so <img> never hits an expired URL. */
export function stableCdnSrc(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  try {
    const u = new URL(trimmed);
    const signed =
      u.searchParams.has("X-Amz-Signature") ||
      u.searchParams.has("X-Amz-Algorithm") ||
      u.searchParams.has("Signature") ||
      u.searchParams.has("Key-Pair-Id");
    if (signed) {
      u.search = "";
      u.hash = "";
    }
    return u.toString();
  } catch {
    return trimmed;
  }
}

/**
 * Remote media from cdn.pickfoo.in / S3.
 * `unoptimized` + `key={src}` so a new unique object key remounts immediately
 * (browser HTTP cache still honors Cache-Control from CloudFront).
 */
export function CdnImage({ src, alt, ...props }: ImageProps) {
  const resolved = typeof src === "string" ? stableCdnSrc(src) : src;
  const cacheKey = typeof resolved === "string" ? resolved : undefined;
  return (
    <NextImage
      key={cacheKey}
      {...props}
      src={resolved}
      alt={alt}
      unoptimized
    />
  );
}
