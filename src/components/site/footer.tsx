import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { agencyContact, legalLinks, navLinks } from "./site-config";

export function Footer() {
  return (
    <footer className="bg-[#111111] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <div>
          <p className="text-xl font-black tracking-[0.08em] text-orange-400">
            {agencyContact.name}
          </p>
          <p className="mt-4 max-w-sm text-sm leading-7 text-white/70">
            Conseil immobilier local à Solliès-Pont pour vendre, acheter ou faire
            estimer une maison, un appartement ou un terrain dans le Var.
          </p>
        </div>

        <div>
          <p className="font-semibold text-white">Navigation</p>
          <ul className="mt-4 grid gap-3 text-sm text-white/70">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link className="transition hover:text-orange-300" href={link.href}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-semibold text-white">Contact</p>
          <ul className="mt-4 grid gap-3 text-sm text-white/70">
            <li className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-orange-400" />
              <span>{agencyContact.address}</span>
            </li>
            <li className="flex gap-2">
              <Phone className="mt-0.5 size-4 shrink-0 text-orange-400" />
              <a className="transition hover:text-orange-300" href={agencyContact.phoneHref}>
                {agencyContact.phone}
              </a>
            </li>
            <li className="flex gap-2">
              <Mail className="mt-0.5 size-4 shrink-0 text-orange-400" />
              <a className="break-all transition hover:text-orange-300" href={agencyContact.emailHref}>
                {agencyContact.email}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-white">Informations légales</p>
          <div className="mt-4 grid gap-3 text-sm text-white/60">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-orange-300">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <Separator className="bg-white/10" />
      <div className="mx-auto max-w-7xl px-4 py-5 text-xs text-white/50 sm:px-6 lg:px-8">
        © 2026 IMMO-DREAMS83. Tous droits réservés. SIRET {agencyContact.siret}.
      </div>
    </footer>
  );
}
