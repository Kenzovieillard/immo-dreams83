import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-orange-100 bg-white px-3 py-2 text-[16px] text-gray-900 transition-colors outline-none file:inline-flex file:min-h-8 file:border-0 file:bg-transparent file:text-[15px] file:font-medium file:text-gray-900 placeholder:text-gray-400 focus-visible:border-orange-500 focus-visible:ring-3 focus-visible:ring-orange-500/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-orange-50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 sm:h-10 sm:text-sm dark:bg-white dark:text-gray-900 dark:disabled:bg-orange-50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
