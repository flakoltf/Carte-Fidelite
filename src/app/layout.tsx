import type { Metadata } from "next";
import { Fraunces, Inter, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://halocard.ch"),
  title: {
    default: "HALO — Cartes de fidélité numériques pour commerçants",
    template: "%s — HaloCard",
  },
  description:
    "Lancez votre carte de fidélité numérique, à votre image, dans Apple & Google Wallet — sans appli à télécharger. Tampons, points, paliers, cashback. Genève.",
  openGraph: {
    type: "website",
    locale: "fr_CH",
    url: "https://halocard.ch",
    siteName: "HaloCard",
    title: "Carte de fidélité numérique Apple & Google Wallet — HaloCard",
    description: "La fidélité des grandes enseignes, à votre image. Sans appli à télécharger.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  // verification: { google: "TOKEN_GSC" }, // ← après création de la propriété Search Console
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${fraunces.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
