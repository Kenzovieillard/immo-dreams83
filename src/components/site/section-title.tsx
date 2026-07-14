import { cn } from "@/lib/utils";

type SectionTitleProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
};

export function SectionTitle({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: SectionTitleProps) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
        className
      )}
    >
      {eyebrow ? (
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-orange-600 sm:text-sm sm:tracking-[0.22em]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-2xl font-black tracking-tight text-[#111111] sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-7 text-gray-600 sm:text-lg">{description}</p>
      ) : null}
    </div>
  );
}
