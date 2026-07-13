import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Footer } from "@/components/site/footer";
import { Navbar } from "@/components/site/navbar";
import { siteUrl } from "@/components/site/site-config";
import { StructuredData } from "@/components/site/structured-data";
import { agencySchema } from "@/lib/schema";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "IMMO-DREAMS83 | Agence immobilière à Solliès-Pont",
    template: "%s | IMMO-DREAMS83",
  },
  description: "Agence immobilière à Solliès-Pont spécialisée dans la vente de maisons, appartements et terrains dans le Var.",
  keywords: [
    "agence immobilière Solliès-Pont",
    "immobilier Var",
    "maison à vendre Toulon",
    "appartement à vendre Hyères",
    "estimation immobilière Var",
    "terrain à vendre Solliès-Pont",
  ],
  alternates: { canonical: siteUrl },
  openGraph: {
    title: "IMMO-DREAMS83 | Votre horizon commence ici",
    description: "Maisons, appartements, terrains et estimations immobilières dans le Var.",
    type: "website",
    locale: "fr_FR",
    url: siteUrl,
    siteName: "IMMO-DREAMS83",
  },
  twitter: { card: "summary_large_image", title: "IMMO-DREAMS83", description: "L'immobilier local dans le Var." },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-svh bg-background">
        <StructuredData data={agencySchema} />
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
