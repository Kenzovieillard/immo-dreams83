import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BedDouble, Home, MapPin, Ruler } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  Property,
  formatPrice,
  propertyStatusBadgeClasses,
  propertyStatusLabels,
  propertyTypeLabels,
} from "@/data/properties";
import { cn } from "@/lib/utils";

type PropertyCardProps = {
  property: Property;
  priority?: boolean;
};

export function PropertyCard({ property, priority = false }: PropertyCardProps) {
  const detailHref = `/biens/${property.slug}`;

  return (
    <Card className="group overflow-hidden border-orange-100 bg-white py-0 shadow-sm shadow-orange-100/60 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-orange-200/50">
      <Link href={detailHref} className="relative block aspect-[4/3] overflow-hidden bg-orange-50">
        <Image
          src={property.photos[0]}
          alt={property.title}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
        <Badge
          className={cn(
            "absolute left-4 top-4 border-0 px-3 py-1 shadow-sm",
            propertyStatusBadgeClasses[property.status]
          )}
        >
          {propertyStatusLabels[property.status]}
        </Badge>
        <p className="absolute bottom-4 left-4 flex items-center gap-1.5 text-sm font-semibold text-white">
          <MapPin className="size-4 text-orange-300" aria-hidden="true" />
          {property.city} ({property.postalCode})
        </p>
      </Link>

      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">
            <Home className="size-4" aria-hidden="true" />
            {propertyTypeLabels[property.type]}
          </span>
          <span className="font-mono text-xs font-semibold text-gray-500">
            {property.reference}
          </span>
        </div>
        <CardTitle className="text-xl font-black leading-tight text-[#111111]">
          <Link href={detailHref} className="transition hover:text-orange-600">
            {property.title}
          </Link>
        </CardTitle>
        <div>
          <p className="text-2xl font-black text-orange-600">{formatPrice(property.price)}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
            Honoraires inclus
          </p>
        </div>
      </CardHeader>

      <CardContent>
        <p className="min-h-14 text-sm leading-6 text-gray-600">
          {property.descriptionShort}
        </p>
        <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
          <span className="rounded-lg bg-orange-50 px-3 py-2 font-semibold text-gray-700">
            <Ruler className="mb-1 size-4 text-orange-500" aria-hidden="true" />
            {property.surface} m2
          </span>
          <span className="rounded-lg bg-orange-50 px-3 py-2 font-semibold text-gray-700">
            <Home className="mb-1 size-4 text-orange-500" aria-hidden="true" />
            {property.rooms ?? "-"} pièces
          </span>
          <span className="rounded-lg bg-orange-50 px-3 py-2 font-semibold text-gray-700">
            <BedDouble className="mb-1 size-4 text-orange-500" aria-hidden="true" />
            {property.bedrooms ?? "-"} ch.
          </span>
        </div>
      </CardContent>

      <CardFooter className="border-orange-100 bg-white p-4">
        <Link
          href={detailHref}
          className={buttonVariants({
            className: "h-11 w-full bg-[#111111] text-white hover:bg-orange-600",
          })}
        >
          Voir le détail
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </CardFooter>
    </Card>
  );
}
