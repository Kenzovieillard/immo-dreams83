"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, RotateCcw } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PropertySearch } from "./property-search";

const clamp = (value: number) => Math.min(1, Math.max(0, value));

function revealBetween(progress: number, start: number, end: number) {
  return clamp((progress - start) / (end - start));
}

function mapScrollProgress(progress: number, start: number, end: number) {
  return revealBetween(progress, start, end);
}

export function RivieraHomeHero() {
  const storyRef = useRef<HTMLElement>(null);
  const frameRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncMotionPreference = () => {
      setReducedMotion(motionQuery.matches);
      if (motionQuery.matches) setProgress(1);
    };

    syncMotionPreference();
    motionQuery.addEventListener("change", syncMotionPreference);

    return () => motionQuery.removeEventListener("change", syncMotionPreference);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      window.dispatchEvent(
        new CustomEvent("riviera-hero-theme", {
          detail: { dark: true, complete: false },
        })
      );
      return;
    }

    const updateProgress = () => {
      frameRef.current = null;
      const story = storyRef.current;
      if (!story) return;

      const rect = story.getBoundingClientRect();
      const scrollableDistance = Math.max(1, story.offsetHeight - window.innerHeight);
      const nextProgress = clamp(-rect.top / scrollableDistance);
      const isInsideStory = rect.top <= 0 && rect.bottom > window.innerHeight;
      const isPastStory = rect.bottom <= window.innerHeight;

      setProgress((current) =>
        Math.abs(current - nextProgress) > 0.001 ? nextProgress : current
      );

      window.dispatchEvent(
        new CustomEvent("riviera-hero-theme", {
          detail: {
            dark: nextProgress >= 0.7,
            complete: isPastStory,
            active: isInsideStory,
          },
        })
      );
    };

    const requestUpdate = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [reducedMotion]);

  const replay = useCallback(() => {
    const story = storyRef.current;
    if (!story) return;

    const storyTop = window.scrollY + story.getBoundingClientRect().top;
    window.scrollTo({
      top: storyTop,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [reducedMotion]);

  const villaProgress = reducedMotion ? 1 : mapScrollProgress(progress, 0.04, 0.92);
  const interiorReveal = reducedMotion ? 1 : revealBetween(progress, 0.68, 0.9);
  const contentReveal = reducedMotion ? 1 : revealBetween(progress, 0.84, 0.98);
  const arrivalReveal = reducedMotion ? 0 : 1 - revealBetween(progress, 0.16, 0.52);
  const villaReveal = reducedMotion ? 0 : 1 - revealBetween(progress, 0.8, 0.96);
  const wordmarkReveal = reducedMotion ? 0 : 1 - revealBetween(progress, 0.34, 0.68);
  const activeStep = reducedMotion ? 4 : Math.min(4, Math.floor(progress * 5));
  const villaScale = 0.72 + villaProgress * 1.34;
  const villaTranslate = 9 - villaProgress * 16;

  return (
    <section
      ref={storyRef}
      className="riviera-scroll-story relative bg-[#f6f2e9]"
      style={{ height: reducedMotion ? "100svh" : "640svh" }}
      aria-label="Présentation IMMO DREAMS"
    >
      <div className="sticky top-0 h-[100svh] min-h-[35rem] overflow-hidden bg-[#f6f2e9]">
        <div
          className="absolute inset-0 bg-[linear-gradient(180deg,#dce8e8_0%,#f7f3ea_58%,#e8d4b7_100%)]"
          style={{ opacity: 1 - interiorReveal }}
        />

        <div className="absolute inset-0">
          <Image
            src="/images/riviera/interior-hero.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
            style={{
              opacity: interiorReveal,
              transform: `scale(${1.06 - interiorReveal * 0.06})`,
            }}
          />
        </div>
        <div
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,17,17,0.72)_0%,rgba(17,17,17,0.38)_50%,rgba(17,17,17,0.82)_100%)]"
          style={{ opacity: interiorReveal }}
        />

        <p
          className="pointer-events-none absolute inset-x-4 top-[13%] z-10 text-center text-[4.4rem] font-black leading-[0.82] text-[#111111] sm:whitespace-nowrap sm:text-[7rem] sm:leading-none lg:text-[9.4rem]"
          style={{
            opacity: wordmarkReveal,
            transform: `scale(${1 - progress * 0.16})`,
          }}
          aria-hidden="true"
        >
          <span className="block sm:inline">IMMO</span>
          <span className="block sm:ml-6 sm:inline">DREAMS</span>
        </p>

        <div
          className="pointer-events-none absolute left-1/2 top-[28%] z-20 h-[47vh] min-h-[17rem] w-[92vw] max-w-[69rem] -translate-x-1/2 md:top-[25%] md:h-[58vh] md:w-[72vw]"
          style={{
            opacity: villaReveal,
          }}
          aria-hidden="true"
        >
          <div
            className="absolute inset-0"
            style={{
              transform: `translate3d(0, ${villaTranslate}%, 0) scale(${villaScale})`,
            }}
          >
            <Image
              src="/images/hero/villa-riviera-scroll-cutout-v2.png"
              alt=""
              fill
              priority
              sizes="(min-width: 768px) 72vw, 92vw"
              className="object-contain drop-shadow-[0_34px_28px_rgba(17,17,17,0.22)]"
            />
          </div>
        </div>

        <p
          className="absolute bottom-24 left-5 z-30 max-w-[12rem] text-[1.25rem] font-medium leading-[1.2] text-[#111111]/82 sm:bottom-20 sm:left-12 sm:max-w-[23rem] sm:text-[1.75rem]"
          style={{ opacity: arrivalReveal }}
        >
          Une adresse peut changer votre horizon.
        </p>

        <div
          className="absolute bottom-[6.1rem] right-5 z-30 flex max-w-[10rem] items-center justify-end gap-2 text-right text-[0.55rem] font-bold uppercase text-[#111111]/68 sm:bottom-20 sm:right-12 sm:max-w-none sm:text-xs"
          style={{ opacity: arrivalReveal }}
        >
          <span>Faites défiler pour approcher</span>
          <ArrowDown className="size-5 text-orange-500" aria-hidden="true" />
        </div>

        <div
          className="absolute inset-0 z-30 flex items-center px-5 pb-24 pt-24 sm:px-8 lg:px-12"
          style={{
            opacity: contentReveal,
            pointerEvents: contentReveal > 0.82 ? "auto" : "none",
          }}
        >
          <p
            className="pointer-events-none absolute left-4 top-28 text-[4.5rem] font-black leading-[0.82] text-white/[0.055] sm:left-auto sm:right-10 sm:top-24 sm:text-right sm:text-[6rem] sm:leading-[0.9]"
            aria-hidden="true"
          >
            IMMO
            <br />
            DREAMS
          </p>
          <div className="mx-auto w-full max-w-[82rem]">
            <div className="max-w-[49rem]">
              <h1 className="max-w-[20rem] text-[2.55rem] font-black leading-[0.98] text-white sm:max-w-[48rem] sm:text-6xl lg:text-[4.25rem]">
                Trouvez le bien de vos rêves dans le Var
              </h1>
              <p className="mt-4 max-w-[43rem] text-sm leading-6 text-white/84 sm:mt-6 sm:text-lg sm:leading-7">
                <span className="sm:hidden">
                  Maisons, appartements et terrains sélectionnés avec exigence.
                </span>
                <span className="hidden sm:inline">
                  Maisons, appartements et terrains sélectionnés avec exigence,
                  pour construire votre projet immobilier dans le Sud de la France.
                </span>
              </p>
              <div className="mt-5 grid gap-3 sm:mt-7 sm:flex">
                <Link
                  href="/a-vendre"
                  className={buttonVariants({
                    className:
                      "h-12 w-full bg-orange-500 px-5 text-white hover:bg-orange-600 sm:w-auto",
                  })}
                >
                  Voir les biens disponibles
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <div className="hidden sm:block">
                  <Link
                    href="/estimation"
                    className={buttonVariants({
                      variant: "outline",
                      className:
                        "h-12 border-white/35 bg-white/10 px-5 text-white backdrop-blur hover:bg-white hover:text-[#111111]",
                    })}
                  >
                    Faire estimer mon bien
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-5 sm:mt-8 lg:ml-12 lg:mr-12">
              <PropertySearch />
            </div>
          </div>
        </div>

        <div
          className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3"
          aria-label={`Étape ${activeStep + 1} sur 5`}
        >
          {Array.from({ length: 5 }, (_, index) => (
            <span
              key={index}
              className={
                index === activeStep
                  ? "h-1 w-8 rounded-full bg-orange-500 transition-all"
                  : "h-1 w-3.5 rounded-full bg-current opacity-25 transition-all"
              }
              style={{ color: interiorReveal > 0.5 ? "#ffffff" : "#111111" }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={replay}
          className="absolute bottom-4 right-5 z-40 inline-flex h-9 items-center gap-2 rounded-lg border border-white/35 bg-black/20 px-3 text-[0.65rem] font-bold uppercase text-white backdrop-blur transition hover:bg-white hover:text-[#111111] md:left-12 md:right-auto"
          style={{
            opacity: contentReveal,
            pointerEvents: contentReveal > 0.82 ? "auto" : "none",
          }}
        >
          Rejouer
          <RotateCcw className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
