"use client";

import { useEffect } from "react";

const MOBILE_VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";

function isEditableElement(element: Element | null) {
  return Boolean(
    element?.matches(
      'input, textarea, select, [contenteditable="true"], [data-slot="select-trigger"]'
    )
  );
}

function blurActiveEditable() {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && isEditableElement(activeElement)) {
    activeElement.blur();
  }
}

function resetHorizontalOffset() {
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
  window.scrollTo(0, window.scrollY);
}

export function MobileViewportGuard() {
  useEffect(() => {
    const viewportMeta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    viewportMeta?.setAttribute("content", MOBILE_VIEWPORT_CONTENT);

    function scheduleReset() {
      requestAnimationFrame(resetHorizontalOffset);
      window.setTimeout(resetHorizontalOffset, 80);
      window.setTimeout(resetHorizontalOffset, 220);
    }

    function handleSubmit() {
      blurActiveEditable();
      scheduleReset();
    }

    function handleFocusOut() {
      scheduleReset();
    }

    function handleTouchEnd(event: TouchEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('button, a, [type="submit"], [role="button"]')) {
        blurActiveEditable();
        scheduleReset();
      }
    }

    document.addEventListener("submit", handleSubmit, true);
    document.addEventListener("focusout", handleFocusOut, true);
    document.addEventListener("touchend", handleTouchEnd, true);
    window.visualViewport?.addEventListener("resize", scheduleReset);

    return () => {
      document.removeEventListener("submit", handleSubmit, true);
      document.removeEventListener("focusout", handleFocusOut, true);
      document.removeEventListener("touchend", handleTouchEnd, true);
      window.visualViewport?.removeEventListener("resize", scheduleReset);
    };
  }, []);

  return null;
}
