import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Kling & Bang",
    template: "%s | Kling & Bang",
  },
  description:
    "Artist-run gallery in Reykjavík, Iceland. Established 2003. Archive of 22+ years of contemporary and experimental art.",
  keywords: [
    "contemporary art",
    "Reykjavík",
    "Iceland",
    "artist-run",
    "gallery",
    "Kling og Bang",
    "experimental art",
  ],
  authors: [{ name: "Kling & Bang" }],
  openGraph: {
    type: "website",
    locale: "is_IS",
    url: "https://klingogbang.is",
    siteName: "Kling & Bang",
    title: "Kling & Bang",
    description:
      "Artist-run gallery in Reykjavík, Iceland. Archive of 22+ years of contemporary art.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kling & Bang",
    description:
      "Artist-run gallery in Reykjavík, Iceland. Archive of 22+ years of contemporary art.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="is">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
