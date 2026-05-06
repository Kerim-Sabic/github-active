import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ActivityBackdrop } from "@/shared/ui/activity-backdrop";
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
  title: "GitHub Active — earn GitHub achievements in one click",
  description:
    "Sign in with GitHub and let GitHub Active run a sandbox repo on your behalf to earn Pull Shark, YOLO, Quickdraw, and Pair Extraordinaire achievements automatically.",
  metadataBase: new URL("https://githubactive.netlify.app"),
  openGraph: {
    title: "GitHub Active — earn GitHub achievements in one click",
    description:
      "Sign in with GitHub. Click a button. Watch real PRs ship into your sandbox repo and unlock GitHub achievements.",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} dark`}>
      <body>
        <ActivityBackdrop />
        {children}
      </body>
    </html>
  );
}
