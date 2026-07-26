import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  Property,
  formatNumber,
  formatPrice,
  propertyStatusBadgeClasses,
  propertyStatusLabels,
} from "@/data/properties";
import { DiagnosticBar } from "@/components/site/diagnostic-bar";
import { cn } from "@/lib/utils";

type PropertyCardProps = {
  property: Property;
  priority?: boolean;
};

export function PropertyCard({ property, priority = false }: PropertyCardProps) {
  const detailHref = `/biens/${property.slug}`;
  const mainPhoto =
    property.photos[0] ??
    "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80";

  const facts = [
    `${formatNumber(property.surface)} m²`,
    property.rooms ? `${property.rooms} pièces` : null,
    property.bedrooms ? `${property.bedrooms} chambres` : null,
  ].filter(Boolean);

  return (
    <article className="group h-full overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-orange-100 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <Link href={detailHref} className="flex h-full flex-col">
        <div className="relative aspect-[16/10] overflow-hidden bg-[#e8e3da]">
          <Image
            src={mainPhoto}
            alt={property.title}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 30vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
          <span
            className={cn(
              "absolute left-4 top-4 rounded-md px-3 py-2 text-[0.65rem] font-bold uppercase shadow-sm",
              propertyStatusBadgeClasses[property.status]
            )}
          >
            {propertyStatusLabels[property.status]}
          </span>
        </div>

        <div className="flex grow flex-col p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.68rem] font-bold uppercase text-orange-600">
                {property.city}
              </p>
              <h3 className="mt-2 text-xl font-black leading-tight text-[#111111]">
                {property.title}
              </h3>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600 transition group-hover:bg-orange-500 group-hover:text-white">
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">{facts.join(" · ")}</p>
            <p className="text-lg font-black text-[#111111]">
              {formatPrice(property.price)}
            </p>
          </div>

          <div className="mt-5 grid gap-3 border-t border-orange-100 pt-4">
            <DiagnosticBar kind="energy" value={property.energyClass} compact />
            <DiagnosticBar kind="climate" value={property.climateClass} compact />
          </div>
        </div>
      </Link>
    </article>
  );
}
