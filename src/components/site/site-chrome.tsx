"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { agencySchema } from "@/lib/schema";
import { Footer } from "@/components/site/footer";
import { Navbar } from "@/components/site/navbar";
import { StructuredData } from "@/components/site/structured-data";

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isCrmRoute = pathname.startsWith("/admin") || pathname.startsWith("/crm-riviera-") || pathname.startsWith("/commercial");

  if (isCrmRoute) {
    return children;
  }

  return (
    <>
      <StructuredData data={agencySchema} />
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
