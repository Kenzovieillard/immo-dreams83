import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-lg border border-orange-100 bg-white px-3 py-2.5 text-[16px] text-gray-900 transition-colors outline-none placeholder:text-gray-400 focus-visible:border-orange-500 focus-visible:ring-3 focus-visible:ring-orange-500/30 disabled:cursor-not-allowed disabled:bg-orange-50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 sm:min-h-20 sm:text-sm dark:bg-white dark:text-gray-900 dark:disabled:bg-orange-50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
