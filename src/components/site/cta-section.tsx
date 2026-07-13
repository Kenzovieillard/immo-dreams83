import Link from "next/link";
import { ArrowRight, Calculator, MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { agencyContact } from "@/components/site/site-config";

type CTASectionProps = {
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
  buttonHref?: string;
};

export function CTASection({
  title = "Votre projet immobilier mérite une stratégie claire.",
  subtitle = "Vente, achat ou estimation : échangeons simplement sur votre situation et les meilleures options dans le marché local du Var.",
  buttonLabel = "Contacter l'agence",
  buttonHref = "/contact",
}: CTASectionProps) {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-xl bg-[#111111] shadow-2xl shadow-orange-200">
        <div className="grid gap-8 bg-gradient-to-r from-orange-600/95 via-orange-500/90 to-yellow-300/85 p-8 md:grid-cols-[1fr_auto] md:items-center md:p-12">
          <div>
            <p className="mb-3 inline-flex items-center rounded-lg bg-white/18 px-3 py-1 text-sm font-semibold text-white">
              IMMO-DREAMS83 à vos côtés
            </p>
            <h2 className="max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl">
              {title}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/90">{subtitle}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:min-w-80 md:grid-cols-1">
            <Link
              href="/estimation"
              className={buttonVariants({
                className: "h-12 bg-white px-5 text-[#111111] hover:bg-orange-50",
              })}
            >
              <Calculator className="size-4" aria-hidden="true" />
              Demander une estimation
            </Link>
            <Link
              href={buttonHref}
              className={buttonVariants({
                variant: "outline",
                className:
                  "h-12 border-white/40 bg-white/10 px-5 text-white backdrop-blur hover:bg-white hover:text-[#111111]",
              })}
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              {buttonLabel}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <a
              href={agencyContact.phoneHref}
              className="text-center text-sm font-bold text-white underline decoration-white/40 underline-offset-4 transition hover:decoration-white"
            >
              Ou appelez le {agencyContact.phone}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
