import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 2xl:h-11 w-full min-w-0 rounded-md border bg-transparent px-3 2xl:px-4 py-1 2xl:py-2 text-base shadow-xs transition-[color,box-shadow,border-color] duration-200 ease-in-out outline-none file:inline-flex file:h-7 2xl:file:h-9 file:border-0 file:bg-transparent file:text-sm 2xl:file:text-base file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm 2xl:text-base",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
