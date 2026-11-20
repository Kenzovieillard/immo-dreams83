"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { settingsHref, type InboxItem } from "@/lib/crm-settings";
import { cn } from "@/lib/utils";
import { settingsApi, settingsDate, settingsError, settingsRequest, textAction } from "./settings-ui";

type Inbox = { items: InboxItem[]; unread: number };

export function SettingsInbox({ className, canNavigate }: { className?: string; canNavigate?: (href: string) => boolean }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await settingsRequest<Inbox>(`${settingsApi}/inbox`, "GET", undefined, signal);
      if (!signal?.aborted) { setInbox(data); setError(""); }
    } catch (cause) {
      if (!signal?.aborted) setError(settingsError(cause));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    function refresh() {
      if (anchor.current?.getClientRects().length && document.visibilityState === "visible") void load(controller.signal);
    }
    refresh();
    const timer = window.setInterval(refresh, 90_000);
    window.addEventListener("resize", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("resize", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  async function markRead() {
    setReading(true);
    setError("");
    try {
      await settingsRequest(settingsApi, "PATCH", { action: "read-inbox" });
      await load();
    } catch (cause) {
      setError(settingsError(cause));
    } finally {
      setReading(false);
    }
  }

  const displayCount = inbox?.unread ?? 0;
  function linkTo(href: string, label: string) {
    return <Link href={href} className={textAction} onNavigate={event => {
      if (canNavigate?.(href)) event.preventDefault();
      setOpen(false);
    }}>{label}</Link>;
  }
  return <>
    <button ref={anchor} type="button" aria-label={displayCount ? `Notifications, ${displayCount} non lues` : "Notifications"}
      className={cn("relative grid size-10 shrink-0 place-items-center rounded-xl border border-[#dedfd4] bg-[#fbfaf7] text-[#2f493a] focus-visible:outline-2", className)}
      onClick={() => { setOpen(true); void load(); }}>
      <Bell className="size-[18px]" aria-hidden="true" />
      {displayCount ? <span className="absolute -right-1 -top-1 rounded-full bg-[#a2473e] px-1.5 py-0.5 text-[10px] font-bold text-white" aria-hidden="true">{displayCount}</span> : null}
    </button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-full overflow-y-auto p-5 sm:max-w-lg">
        <SheetHeader className="p-0 pr-8"><SheetTitle>Notifications</SheetTitle><SheetDescription>Activité de votre portefeuille et rappels du CRM.</SheetDescription></SheetHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" disabled={!displayCount || reading} onClick={() => void markRead()}>Tout marquer comme lu</Button>
          {linkTo(settingsHref("notifications"), "Préférences")}
        </div>
        {error ? <p role="alert" className="text-sm text-[#a2473e]">{error}</p> : null}
        {!inbox && !error ? <p role="status">Chargement…</p> : null}
        {inbox && !inbox.items.length ? <p className="text-sm text-[#536358]">Aucune notification pour le moment.</p> : null}
        <ul className="grid gap-2">{inbox?.items.map(item => <li key={item.id} className={cn("rounded-lg border border-[#dedfd4] p-3", item.unread && "bg-[#e3ebdf]")}>
          <div className="flex flex-wrap items-start justify-between gap-1">
            <p className="font-semibold">{item.title}{item.unread ? <span className="sr-only"> (non lue)</span> : null}</p>
            <time dateTime={item.date} className="text-xs text-[#536358]">{settingsDate(item.date)}</time>
          </div>
          <p className="text-sm text-[#536358]">{item.summary}</p>
          {linkTo(item.href, "Ouvrir")}
        </li>)}</ul>
      </SheetContent>
    </Sheet>
  </>;
}
