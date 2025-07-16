import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm 2xl:text-base font-medium transition-all duration-200 ease-in-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 2xl:[&_svg:not([class*='size-'])]:size-5 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-95 active:transition-transform active:duration-100",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:shadow-sm active:shadow-none",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 hover:shadow-sm active:shadow-none focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground hover:shadow-sm active:shadow-none dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 hover:shadow-sm active:shadow-none",
        ghost:
          "hover:bg-accent hover:text-accent-foreground hover:shadow-sm active:shadow-none dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline active:text-primary/80",
      },
      size: {
        default: "h-9 2xl:h-11 px-4 2xl:px-5 py-2 2xl:py-2.5 has-[>svg]:px-3 2xl:has-[>svg]:px-4",
        sm: "h-8 2xl:h-10 rounded-md gap-1.5 px-3 2xl:px-4 has-[>svg]:px-2.5 2xl:has-[>svg]:px-3",
        lg: "h-10 2xl:h-12 rounded-md px-6 2xl:px-8 has-[>svg]:px-4 2xl:has-[>svg]:px-5",
        icon: "size-9 2xl:size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
