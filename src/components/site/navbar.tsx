"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
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

const headerLinks = [
  { href: "/a-vendre", label: "Biens" },
  { href: "/contact", label: "Vendre" },
  { href: "/estimation", label: "Estimer" },
  { href: "/agence", label: "L'agence" },
];

const imageHeroRoutes = new Set([
  "/a-vendre",
  "/biens",
  "/agence",
  "/estimation",
  "/contact",
]);

type RivieraHeroThemeEvent = CustomEvent<{
  dark?: boolean;
  complete?: boolean;
}>;

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [homeHeroDark, setHomeHeroDark] = useState(false);
  const [homeHeroComplete, setHomeHeroComplete] = useState(false);
  const isHome = pathname === "/";
  const overlaysImageHero = imageHeroRoutes.has(pathname);
  const isPropertyDetail = pathname.startsWith("/biens/");
  const isLegalRoute =
    pathname === "/mentions-legales" || pathname.startsWith("/legal/");
  const isOverlayHeader = isHome || overlaysImageHero;
  const usesDarkHeader =
    overlaysImageHero ||
    isPropertyDetail ||
    isLegalRoute ||
    (isHome && (homeHeroDark || homeHeroComplete));
  const showsSolidDarkHeader =
    (!isOverlayHeader && usesDarkHeader) || (isHome && homeHeroComplete);

  useEffect(() => {
    if (!isHome) return;

    const syncTheme = (event: Event) => {
      const detail = (event as RivieraHeroThemeEvent).detail;
      setHomeHeroDark(Boolean(detail?.dark));
      setHomeHeroComplete(Boolean(detail?.complete));
    };

    window.addEventListener("riviera-hero-theme", syncTheme);
    return () => window.removeEventListener("riviera-hero-theme", syncTheme);
  }, [isHome]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header
      className={cn(
        "top-0 z-50 w-full transition-colors duration-300",
        isOverlayHeader ? "fixed inset-x-0" : "sticky",
        showsSolidDarkHeader
          ? "border-b border-white/10 bg-[#111111]/92 text-white backdrop-blur-md"
          : usesDarkHeader
            ? "border-b border-transparent bg-transparent text-white"
            : isOverlayHeader
              ? "border-b border-transparent bg-transparent text-[#111111]"
              : "border-b border-orange-100 bg-white text-[#111111]",
        isHome && !homeHeroComplete && "backdrop-blur-none"
      )}
    >
      <div className="mx-auto grid h-[4.5rem] max-w-[90rem] grid-cols-[1fr_auto] items-center px-5 sm:h-[5.5rem] sm:px-8 xl:grid-cols-[16rem_1fr_16rem] xl:px-12">
        <Link
          href="/"
          className="w-fit text-sm font-black leading-none sm:text-lg"
          aria-label="Accueil IMMO DREAMS"
        >
          IMMO DREAMS
        </Link>

        <nav
          className="hidden items-center justify-center gap-8 xl:flex"
          aria-label="Navigation principale"
        >
          {headerLinks.map((link) => {
            const baseHref = link.href.split("#")[0];
            const active =
              baseHref === "/a-vendre"
                ? pathname === "/a-vendre" || pathname.startsWith("/biens")
                : pathname === baseHref;

            return (
              <Link
                key={`${link.href}-${link.label}`}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-xs font-bold uppercase transition",
                  usesDarkHeader
                    ? "text-white/72 hover:text-white"
                    : "text-[#111111]/72 hover:text-[#111111]",
                  active && (usesDarkHeader ? "text-white" : "text-[#111111]")
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden justify-end xl:flex">
          <Link
            href="/contact"
            className={buttonVariants({
              variant: usesDarkHeader ? "outline" : undefined,
              className: usesDarkHeader
                ? "h-12 w-40 border-white/30 bg-white/10 text-[0.7rem] font-bold uppercase text-white backdrop-blur hover:bg-white hover:text-[#111111]"
                : "h-12 w-40 !bg-[#111111] text-[0.7rem] font-bold uppercase !text-white hover:!bg-orange-600",
            })}
          >
            Nous contacter
          </Link>
        </div>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger
            render={
              <Button
                variant="outline"
                size="icon-lg"
                className={cn(
                  "justify-self-end xl:hidden",
                  usesDarkHeader
                    ? "border-white/30 bg-white/10 text-white backdrop-blur"
                    : "border-[#111111]/20 bg-white/40 text-[#111111] backdrop-blur"
                )}
                aria-label="Ouvrir le menu"
              />
            }
          >
            <Menu className="size-5" aria-hidden="true" />
          </SheetTrigger>
          <SheetContent className="w-[min(92vw,24rem)] bg-[#fbf9f4]" side="right">
            <SheetHeader className="border-b border-orange-100 pb-5">
              <SheetTitle className="text-xl font-black text-[#111111]">
                IMMO DREAMS
              </SheetTitle>
              <SheetDescription>Agence immobilière à Solliès-Pont</SheetDescription>
            </SheetHeader>
            <div className="grid gap-1 px-4 py-3">
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
            <div className="mt-auto p-4">
              <Link
                href="/contact"
                onClick={closeMobileMenu}
                className={buttonVariants({
                  className: "h-12 w-full bg-orange-500 text-white hover:bg-orange-600",
                })}
              >
                Nous contacter
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
