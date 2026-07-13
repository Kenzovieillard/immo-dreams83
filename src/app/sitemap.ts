import type { MetadataRoute } from "next";
import { siteUrl } from "@/components/site/site-config";
import { properties } from "@/data/properties";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/agence",
    "/a-vendre",
    "/estimation",
    "/biens",
    "/contact",
    "/mentions-legales",
    "/legal/privacy-policy",
    "/legal/cookies",
  ];

  return [
    ...staticRoutes.map((route) => ({
      url: `${siteUrl}${route}`,
      lastModified: new Date("2026-06-29"),
      changeFrequency: route === "" ? ("weekly" as const) : ("monthly" as const),
      priority: route === "" ? 1 : route === "/a-vendre" || route === "/estimation" ? 0.9 : 0.7,
    })),
    ...properties.map((property) => ({
      url: `${siteUrl}/biens/${property.slug}`,
      lastModified: new Date(property.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
      images: property.photos.slice(0, 3),
    })),
  ];
}
