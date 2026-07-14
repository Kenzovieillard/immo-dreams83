"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Menu } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { navLinks } from "./site-config";

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-orange-100/80 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Accueil IMMO-DREAMS83">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#111111] text-orange-400 shadow-sm">
            <Home className="size-5" aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-black tracking-[0.08em] text-[#111111] sm:text-base">
              IMMO-DREAMS83
            </span>
            <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-orange-600 sm:text-xs">
              Solliès-Pont
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 xl:flex" aria-label="Navigation principale">
          {navLinks.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-orange-50 hover:text-orange-700",
                  active && "bg-orange-50 text-orange-700"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 xl:flex">
          <Link
            href="/estimation"
            className={buttonVariants({
              className:
                "h-10 bg-orange-500 px-4 text-white shadow-sm shadow-orange-200 hover:bg-orange-600",
            })}
          >
            Estimer mon bien
          </Link>
        </div>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger
            render={
              <Button
                variant="outline"
                size="icon-lg"
                className="border-orange-200 text-gray-900 xl:hidden"
                aria-label="Ouvrir le menu"
              />
            }
          >
            <Menu className="size-5" aria-hidden="true" />
          </SheetTrigger>
          <SheetContent className="w-[min(92vw,24rem)] bg-white" side="right">
            <SheetHeader>
              <SheetTitle>IMMO-DREAMS83</SheetTitle>
              <SheetDescription>Agence immobilière à Solliès-Pont</SheetDescription>
            </SheetHeader>
            <div className="grid gap-2 px-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMobileMenu}
                  className="rounded-lg px-3 py-3.5 text-base font-semibold text-gray-800 transition hover:bg-orange-50 hover:text-orange-700"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="p-4">
              <Link
                href="/estimation"
                onClick={closeMobileMenu}
                className={buttonVariants({
                  className: "h-11 w-full bg-orange-500 text-white hover:bg-orange-600",
                })}
              >
                Estimer mon bien
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
