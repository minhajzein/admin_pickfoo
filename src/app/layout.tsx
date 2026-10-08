import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import { readMapboxAccessToken } from "@/lib/mapbox-token";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  // Apply on <html>, not <body> — avoids React attributing layout work to body.__className_*
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Pickfoo Admin | Supercharge Your Platform",
  description: "Administrative dashboard for Pickfoo food delivery",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${inter.className}`}>
      <body className="min-h-dvh font-sans antialiased">
        <Providers mapboxToken={readMapboxAccessToken()}>{children}</Providers>
      </body>
    </html>
  );
}
