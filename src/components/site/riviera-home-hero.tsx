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

const SMOOTHING_TIME_MS = 70;
const PROGRESS_EPSILON = 0.0005;

type HeroThemeState = {
  dark: boolean;
  complete: boolean;
  active: boolean;
};

export function RivieraHomeHero() {
  const storyRef = useRef<HTMLElement>(null);
  const frameRef = useRef<number | null>(null);
  const targetProgressRef = useRef(0);
  const renderedProgressRef = useRef(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const metricsRef = useRef({ top: 0, distance: 1 });
  const themeStateRef = useRef<HeroThemeState | null>(null);
  const contentInteractiveRef = useRef(false);
  const activeStepRef = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const replayRef = useRef<HTMLButtonElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [reducedMotion, setReducedMotion] = useState(false);

  const applyVisualProgress = useCallback(
    (progress: number, complete = progress >= 0.999) => {
      const story = storyRef.current;
      if (!story) return;

      const villaProgress = mapScrollProgress(progress, 0.04, 0.92);
      const interiorReveal = revealBetween(progress, 0.68, 0.9);
      const contentReveal = revealBetween(progress, 0.84, 0.98);
      const arrivalReveal = 1 - revealBetween(progress, 0.16, 0.52);
      const villaReveal = 1 - revealBetween(progress, 0.8, 0.96);
      const wordmarkReveal = 1 - revealBetween(progress, 0.34, 0.68);
      const villaScale = 0.72 + villaProgress * 1.34;
      const villaTranslate = 9 - villaProgress * 16;

      story.style.setProperty("--riviera-sky-opacity", `${1 - interiorReveal}`);
      story.style.setProperty("--riviera-interior-opacity", `${interiorReveal}`);
      story.style.setProperty(
        "--riviera-interior-scale",
        `${1.06 - interiorReveal * 0.06}`
      );
      story.style.setProperty("--riviera-wordmark-opacity", `${wordmarkReveal}`);
      story.style.setProperty("--riviera-wordmark-scale", `${1 - progress * 0.16}`);
      story.style.setProperty("--riviera-villa-opacity", `${villaReveal}`);
      story.style.setProperty("--riviera-villa-translate", `${villaTranslate}%`);
      story.style.setProperty("--riviera-villa-scale", `${villaScale}`);
      story.style.setProperty("--riviera-arrival-opacity", `${arrivalReveal}`);
      story.style.setProperty("--riviera-content-opacity", `${contentReveal}`);
      story.style.setProperty(
        "--riviera-step-color",
        interiorReveal > 0.5 ? "#ffffff" : "#111111"
      );

      const isContentInteractive = contentReveal > 0.82;
      if (contentInteractiveRef.current !== isContentInteractive) {
        contentInteractiveRef.current = isContentInteractive;
        const pointerEvents = isContentInteractive ? "auto" : "none";
        if (contentRef.current) contentRef.current.style.pointerEvents = pointerEvents;
        if (replayRef.current) replayRef.current.style.pointerEvents = pointerEvents;
      }

      const activeStep = Math.min(4, Math.floor(progress * 5));
      if (activeStepRef.current !== activeStep) {
        activeStepRef.current = activeStep;
        indicatorRef.current?.setAttribute(
          "aria-label",
          `Étape ${activeStep + 1} sur 5`
        );
        stepRefs.current.forEach((step, index) => {
          if (step) step.dataset.active = index === activeStep ? "true" : "false";
        });
      }

      const nextTheme: HeroThemeState = {
        dark: progress >= 0.7,
        complete,
        active: progress > 0 && !complete,
      };
      const currentTheme = themeStateRef.current;

      if (
        !currentTheme ||
        currentTheme.dark !== nextTheme.dark ||
        currentTheme.complete !== nextTheme.complete ||
        currentTheme.active !== nextTheme.active
      ) {
        themeStateRef.current = nextTheme;
        window.dispatchEvent(
          new CustomEvent("riviera-hero-theme", {
            detail: nextTheme,
          })
        );
      }
    },
    []
  );

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncMotionPreference = () => {
      setReducedMotion(motionQuery.matches);
    };

    syncMotionPreference();
    motionQuery.addEventListener("change", syncMotionPreference);

    return () => motionQuery.removeEventListener("change", syncMotionPreference);
  }, []);

  useEffect(() => {
    const story = storyRef.current;
    if (!story) return;

    const measureStory = () => {
      const rect = story.getBoundingClientRect();
      metricsRef.current = {
        top: window.scrollY + rect.top,
        distance: Math.max(1, story.offsetHeight - window.innerHeight),
      };
    };

    const updateTargetProgress = () => {
      const { top, distance } = metricsRef.current;
      targetProgressRef.current = clamp((window.scrollY - top) / distance);
    };

    const animateProgress = (timestamp: number) => {
      frameRef.current = null;
      updateTargetProgress();

      const target = targetProgressRef.current;
      const current = renderedProgressRef.current;
      const elapsed = lastFrameTimeRef.current
        ? Math.min(64, timestamp - lastFrameTimeRef.current)
        : 16.67;
      const smoothing = 1 - Math.exp(-elapsed / SMOOTHING_TIME_MS);
      const next =
        Math.abs(target - current) <= PROGRESS_EPSILON
          ? target
          : current + (target - current) * smoothing;

      lastFrameTimeRef.current = timestamp;
      renderedProgressRef.current = next;
      applyVisualProgress(next);

      if (Math.abs(target - next) > PROGRESS_EPSILON) {
        frameRef.current = window.requestAnimationFrame(animateProgress);
      } else {
        lastFrameTimeRef.current = null;
      }
    };

    const requestAnimation = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(animateProgress);
    };

    const handleScroll = () => {
      updateTargetProgress();
      requestAnimation();
    };

    const handleResize = () => {
      measureStory();
      updateTargetProgress();
      requestAnimation();
    };

    measureStory();
    updateTargetProgress();

    if (reducedMotion) {
      targetProgressRef.current = 1;
      renderedProgressRef.current = 1;
      applyVisualProgress(1, false);
      return;
    }

    renderedProgressRef.current = targetProgressRef.current;
    applyVisualProgress(renderedProgressRef.current);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("scrollend", handleScroll);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scrollend", handleScroll);
      window.removeEventListener("resize", handleResize);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      lastFrameTimeRef.current = null;
    };
  }, [applyVisualProgress, reducedMotion]);

  const replay = useCallback(() => {
    const story = storyRef.current;
    if (!story) return;

    const storyTop = window.scrollY + story.getBoundingClientRect().top;
    window.scrollTo({
      top: storyTop,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [reducedMotion]);

  return (
    <section
      ref={storyRef}
      className="riviera-scroll-story relative bg-[#f6f2e9]"
      style={reducedMotion ? { height: "100svh" } : undefined}
      aria-label="Présentation IMMO DREAMS"
    >
      <div className="sticky top-0 h-[100svh] min-h-[35rem] overflow-hidden bg-[#f6f2e9]">
        <div
          className="absolute inset-0 bg-[linear-gradient(180deg,#dce8e8_0%,#f7f3ea_58%,#e8d4b7_100%)]"
          style={{ opacity: "var(--riviera-sky-opacity)" }}
        />

        <div className="absolute inset-0">
          <Image
            src="/images/riviera/interior-hero.jpg"
            alt=""
            fill
            fetchPriority="low"
            sizes="100vw"
            className="object-cover"
            style={{
              opacity: "var(--riviera-interior-opacity)",
              transform: "scale(var(--riviera-interior-scale))",
            }}
          />
        </div>
        <div
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,17,17,0.72)_0%,rgba(17,17,17,0.38)_50%,rgba(17,17,17,0.82)_100%)]"
          style={{ opacity: "var(--riviera-interior-opacity)" }}
        />

        <p
          className="pointer-events-none absolute inset-x-4 top-[13%] z-10 text-center text-[4.4rem] font-black leading-[0.82] text-[#111111] sm:whitespace-nowrap sm:text-[5rem] sm:leading-none md:text-[6rem] lg:text-[9.4rem]"
          style={{
            opacity: "var(--riviera-wordmark-opacity)",
            transform: "scale(var(--riviera-wordmark-scale))",
          }}
          aria-hidden="true"
        >
          <span className="block sm:inline">IMMO</span>
          <span className="block sm:ml-6 sm:inline">DREAMS</span>
        </p>

        <div
          className="pointer-events-none absolute left-1/2 top-[28%] z-20 h-[47vh] min-h-[17rem] w-[92vw] max-w-[69rem] -translate-x-1/2 md:top-[25%] md:h-[58vh] md:w-[72vw]"
          style={{
            opacity: "var(--riviera-villa-opacity)",
          }}
          aria-hidden="true"
        >
          <div
            className="absolute inset-0"
            style={{
              transform:
                "translate3d(0, var(--riviera-villa-translate), 0) scale(var(--riviera-villa-scale))",
            }}
          >
            <Image
              src="/images/hero/villa-riviera-scroll-cutout-v2.webp"
              alt=""
              fill
              priority
              fetchPriority="high"
              sizes="(min-width: 768px) 72vw, 92vw"
              className="object-contain drop-shadow-[0_34px_28px_rgba(17,17,17,0.22)]"
            />
          </div>
        </div>

        <p
          className="absolute bottom-24 left-5 z-30 max-w-[12rem] text-[1.25rem] font-medium leading-[1.2] text-[#111111]/82 sm:bottom-20 sm:left-12 sm:max-w-[23rem] sm:text-[1.75rem]"
          style={{ opacity: "var(--riviera-arrival-opacity)" }}
        >
          Une adresse peut changer votre horizon.
        </p>

        <div
          className="absolute bottom-[6.1rem] right-5 z-30 flex max-w-[10rem] items-center justify-end gap-2 text-right text-[0.55rem] font-bold uppercase text-[#111111]/68 sm:bottom-20 sm:right-12 sm:max-w-none sm:text-xs"
          style={{ opacity: "var(--riviera-arrival-opacity)" }}
        >
          <span>Faites défiler pour approcher</span>
          <ArrowDown className="size-5 text-orange-500" aria-hidden="true" />
        </div>

        <div
          ref={contentRef}
          className="absolute inset-0 z-30 flex items-center px-5 pb-24 pt-24 sm:px-8 lg:px-12"
          style={{
            opacity: "var(--riviera-content-opacity)",
            pointerEvents: "none",
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
          ref={indicatorRef}
          className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3"
          aria-label="Étape 1 sur 5"
        >
          {Array.from({ length: 5 }, (_, index) => (
            <span
              key={index}
              ref={(step) => {
                stepRefs.current[index] = step;
              }}
              className="riviera-scroll-step h-1 rounded-full"
              data-active={index === 0 ? "true" : "false"}
            />
          ))}
        </div>

        <button
          ref={replayRef}
          type="button"
          onClick={replay}
          className="absolute bottom-4 right-5 z-40 inline-flex h-9 items-center gap-2 rounded-lg border border-white/35 bg-black/20 px-3 text-[0.65rem] font-bold uppercase text-white backdrop-blur transition hover:bg-white hover:text-[#111111] md:left-12 md:right-auto"
          style={{
            opacity: "var(--riviera-content-opacity)",
            pointerEvents: "none",
          }}
        >
          Rejouer
          <RotateCcw className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
