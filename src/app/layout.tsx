import type { Metadata, Viewport } from "next";
import { MobileViewportGuard } from "@/components/site/mobile-viewport-guard";
import { siteUrl } from "@/components/site/site-config";
import { SiteChrome } from "@/components/site/site-chrome";
import "./globals.css";

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
    images: [{ url: "/images/riviera/interior-hero.jpg", width: 1600, height: 1067, alt: "Intérieur d'une villa contemporaine dans le Var" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "IMMO-DREAMS83",
    description: "L'immobilier local dans le Var.",
    images: ["/images/riviera/interior-hero.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f97316",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-dvh bg-background">
        <MobileViewportGuard />
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
