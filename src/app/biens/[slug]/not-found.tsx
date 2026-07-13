import Link from "next/link";
import { Home, Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function PropertyNotFound() {
  return (
    <section className="bg-orange-50 px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-xl border border-orange-100 bg-white p-8 text-center shadow-xl shadow-orange-100/60">
        <span className="mx-auto flex size-14 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
          <Home className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-6 text-3xl font-black text-[#111111]">
          Ce bien n&apos;est plus disponible
        </h1>
        <p className="mt-4 text-base leading-7 text-gray-600">
          La référence demandée a peut-être été vendue, retirée ou remplacée par une
          nouvelle sélection. Consultez les biens disponibles ou contactez l&apos;agence.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/a-vendre"
            className={buttonVariants({
              className: "h-11 bg-orange-500 px-5 text-white hover:bg-orange-600",
            })}
          >
            <Search className="size-4" aria-hidden="true" />
            Voir les biens disponibles
          </Link>
          <Link
            href="/contact"
            className={buttonVariants({
              variant: "outline",
              className: "h-11 border-orange-200 px-5 text-orange-700 hover:bg-orange-50",
            })}
          >
            Contacter l&apos;agence
          </Link>
        </div>
      </div>
    </section>
  );
}
