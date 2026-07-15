import { ExternalLink, MapPin } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GoogleMapEmbedProps = {
  query: string;
  title: string;
  heightClassName?: string;
  className?: string;
  helperText?: string;
  openMapsLabel?: string;
};

export function GoogleMapEmbed({
  query,
  title,
  heightClassName = "h-72 sm:h-80",
  className,
  helperText,
  openMapsLabel = "Ouvrir dans Google Maps",
}: GoogleMapEmbedProps) {
  const encodedQuery = encodeURIComponent(query);
  const mapUrl = `https://www.google.com/maps?q=${encodedQuery}&output=embed`;
  const openMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-xl shadow-orange-100/60",
        className
      )}
    >
      <div className="flex flex-col gap-3 border-b border-orange-100 bg-orange-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#111111] text-orange-300 shadow-sm">
            <MapPin className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-black text-[#111111] sm:text-lg">{title}</h2>
            {helperText ? (
              <p className="mt-1 text-sm leading-6 text-gray-600">{helperText}</p>
            ) : null}
          </div>
        </div>
        <a
          href={openMapsUrl}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({
            variant: "outline",
            className:
              "h-11 shrink-0 border-orange-200 bg-white text-orange-700 hover:bg-orange-50 sm:h-10",
          })}
        >
          {openMapsLabel}
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </div>
      <div className={cn("bg-orange-50 p-3 sm:p-4", heightClassName)}>
        <iframe
          title={title}
          src={mapUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-full w-full rounded-xl border border-orange-100 bg-white"
        />
      </div>
    </section>
  );
}
