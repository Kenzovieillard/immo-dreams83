"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PropertyGallery({ photos, title }: { photos: string[]; title: string }) {
  const galleryPhotos =
    photos.length > 0
      ? photos
      : ["https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=80"];
  const [activeIndex, setActiveIndex] = useState(0);
  const count = galleryPhotos.length;

  function move(direction: number) {
    setActiveIndex((current) => (current + direction + count) % count);
  }

  return (
    <div className="grid gap-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-orange-100 shadow-xl shadow-orange-200/40 sm:aspect-[16/10]">
        <Image
          src={galleryPhotos[activeIndex]}
          alt={`${title} - photo ${activeIndex + 1}`}
          fill
          priority
          sizes="(min-width: 1024px) 70vw, 100vw"
          className="object-cover"
        />
        <Badge className="absolute left-4 top-4 border-0 bg-black/75 text-white">
          <Images className="size-4" aria-hidden="true" />
          {activeIndex + 1} / {count}
        </Badge>
        {count > 1 ? (
          <>
            <Button aria-label="Photo précédente" size="icon" variant="secondary" onClick={() => move(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 shadow-lg hover:bg-white">
              <ChevronLeft className="size-5" />
            </Button>
            <Button aria-label="Photo suivante" size="icon" variant="secondary" onClick={() => move(1)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 shadow-lg hover:bg-white">
              <ChevronRight className="size-5" />
            </Button>
          </>
        ) : null}
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
        {galleryPhotos.map((photo, index) => (
          <button
            key={photo}
            type="button"
            aria-label={`Afficher la photo ${index + 1}`}
            aria-current={activeIndex === index}
            onClick={() => setActiveIndex(index)}
            className={cn(
              "relative aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-md border-2 bg-orange-50 transition sm:w-36",
              activeIndex === index ? "border-orange-500" : "border-transparent opacity-70 hover:opacity-100"
            )}
          >
            <Image src={photo} alt="" fill sizes="144px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
