import type { Metadata } from "next";
import { Geist, Geist_Mono, Archivo_Black } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { DemoBanner } from "@/components/DemoBanner";
import { MemorialDayBanner } from "@/components/MemorialDayBanner";
import { PromoStrip } from "@/components/PromoStrip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Cheap Shot Hockey — Hockey gear at a fighting price",
  description:
    "Hockey sticks, skates, helmets, gloves, pads, jerseys, and goalie gear — all marked down. Free shipping over $99.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${archivoBlack.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DemoBanner />
        <MemorialDayBanner />
        <PromoStrip />
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
