import { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HeroAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
  phone?: boolean;
};

type RivieraPageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: HeroAction[];
  height?: "compact" | "large";
  align?: "left" | "center";
  children?: ReactNode;
  className?: string;
};

export function RivieraPageHero({
  eyebrow,
  title,
  description,
  actions = [],
  height = "compact",
  align = "left",
  children,
  className,
}: RivieraPageHeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden bg-[#111111] text-white",
        height === "large"
          ? "min-h-[38rem] sm:min-h-[43rem]"
          : "min-h-[27rem] sm:min-h-[35rem]",
        className
      )}
    >
      <Image
        src="/images/riviera/interior-hero.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-[#111111]/68" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(17,17,17,0.35),transparent_70%)]" />

      <div
        className={cn(
          "relative mx-auto flex min-h-[inherit] w-full max-w-[82rem] flex-col justify-center px-5 pb-16 pt-28 sm:px-8 sm:pb-20 sm:pt-32",
          align === "center" && "items-center text-center"
        )}
      >
        <div className={cn("max-w-[47rem]", align === "center" && "mx-auto")}>
          <p className="text-xs font-bold uppercase text-orange-400 sm:text-sm">
            {eyebrow}
          </p>
          <h1 className="mt-4 max-w-[21rem] text-[2.55rem] font-black leading-[0.98] sm:max-w-[46rem] sm:text-6xl lg:text-[3.9rem]">
            {title}
          </h1>
          <p className="mt-5 max-w-[44rem] text-base leading-7 text-white/82 sm:text-lg sm:leading-8">
            {description}
          </p>

          {actions.length > 0 ? (
            <div
              className={cn(
                "mt-7 flex flex-col gap-3 sm:flex-row",
                align === "center" && "sm:justify-center"
              )}
            >
              {actions.map((action) => {
                const className = buttonVariants({
                  variant: action.variant === "secondary" ? "outline" : undefined,
                  className:
                    action.variant === "secondary"
                      ? "h-12 border-white/35 bg-white/10 px-5 text-white backdrop-blur hover:bg-white hover:text-[#111111]"
                      : "h-12 bg-orange-500 px-5 text-white hover:bg-orange-600",
                });
                const content = (
                  <>
                    {action.phone ? (
                      <Phone className="size-4" aria-hidden="true" />
                    ) : null}
                    {action.label}
                    {!action.phone && action.variant !== "secondary" ? (
                      <ArrowRight className="size-4" aria-hidden="true" />
                    ) : null}
                  </>
                );

                return action.href.startsWith("tel:") ||
                  action.href.startsWith("mailto:") ? (
                  <a
                    key={`${action.href}-${action.label}`}
                    href={action.href}
                    className={className}
                  >
                    {content}
                  </a>
                ) : (
                  <Link
                    key={`${action.href}-${action.label}`}
                    href={action.href}
                    className={className}
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>

        {children}
      </div>
    </section>
  );
}
