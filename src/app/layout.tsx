import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap"
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap"
});

export const metadata: Metadata = {
  title: "GitHub Active - GitHub developer journal automation",
  description: "Transparent Netlify-hosted developer journal automation for user-owned GitHub repositories.",
  metadataBase: new URL("https://github.com/Kerim-Sabic/github-active")
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} dark`}>
      <body>{children}</body>
    </html>
  );
}
