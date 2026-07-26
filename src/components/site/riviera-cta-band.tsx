import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

type RivieraCtaBandProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  href?: string;
  label?: string;
};

export function RivieraCtaBand({
  eyebrow = "Votre projet commence ici",
  title = "Vous vendez un bien dans le Var ?",
  description = "Obtenez une première estimation et une stratégie de mise en marché claire.",
  href = "/estimation",
  label = "Estimer mon bien",
}: RivieraCtaBandProps) {
  const actionClassName = buttonVariants({
    className:
      "h-12 w-full bg-orange-500 px-6 text-white hover:bg-orange-600 sm:w-auto",
  });
  const actionContent = (
    <>
      {label}
      <ArrowRight className="size-4" aria-hidden="true" />
    </>
  );

  return (
    <section className="bg-[#fbf9f4] px-5 py-14 sm:px-8 sm:py-20">
      <div className="mx-auto grid max-w-[80rem] gap-7 rounded-lg bg-[#111111] px-6 py-9 text-white sm:px-10 sm:py-12 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase text-orange-400">{eyebrow}</p>
          <h2 className="mt-4 max-w-[43rem] text-3xl font-black leading-tight sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 max-w-[43rem] text-sm leading-6 text-white/72 sm:text-base">
            {description}
          </p>
        </div>
        {href.startsWith("tel:") || href.startsWith("mailto:") ? (
          <a href={href} className={actionClassName}>
            {actionContent}
          </a>
        ) : (
          <Link href={href} className={actionClassName}>
            {actionContent}
          </Link>
        )}
      </div>
    </section>
  );
}
