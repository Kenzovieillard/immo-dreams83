import { Menu, type LucideIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

export function CommercialSidebarMenu({
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  icon: LucideIcon;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const linksId = useId();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={linksId}
        onClick={() => setOpen((value) => !value)}
        className="mt-1 flex min-h-10 w-full items-center gap-3 rounded-lg px-4 text-left text-[13px] font-medium text-[#cbd5e1] transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white aria-expanded:text-white"
      >
        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
        <span className="flex-1">Commercial</span>
        <Menu className="size-4 shrink-0" aria-hidden="true" />
      </button>
      <div id={linksId} hidden={!open}>
        {children}
      </div>
    </>
  );
}
