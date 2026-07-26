import Link from "next/link";
import { agencyContact, legalLinks } from "./site-config";

const footerNavigation = [
  { href: "/a-vendre", label: "Biens" },
  { href: "/estimation", label: "Estimation" },
  { href: "/agence", label: "Agence" },
  { href: "/contact", label: "Contact" },
];

export function Footer() {
  return (
    <footer className="bg-[#111111] text-white">
      <div className="mx-auto grid max-w-[90rem] gap-9 px-5 py-10 sm:px-8 sm:py-12 lg:grid-cols-[1fr_auto_1fr] lg:items-end lg:px-12">
        <div>
          <p className="text-lg font-black">IMMO DREAMS</p>
          <p className="mt-3 text-sm leading-6 text-white/65">
            {agencyContact.city} · Var
            <br />
            <a
              className="transition hover:text-orange-300"
              href={agencyContact.phoneHref}
            >
              {agencyContact.phone}
            </a>
          </p>
        </div>

        <nav
          className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold uppercase"
          aria-label="Navigation du pied de page"
        >
          {footerNavigation.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-white/72 transition hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/55 lg:justify-end">
          {legalLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-orange-300"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-4 text-center text-[0.68rem] text-white/45 sm:px-8">
        © 2026 IMMO DREAMS. Tous droits réservés. SIRET {agencyContact.siret}.
      </div>
    </footer>
  );
}
