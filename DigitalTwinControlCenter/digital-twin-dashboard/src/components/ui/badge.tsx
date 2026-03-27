import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-cobalt focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-cobalt text-white hover:bg-cobalt/90",
        secondary:
          "border-transparent bg-mist text-ink hover:bg-haze/80",
        destructive:
          "border-transparent bg-ember text-white hover:bg-ember/90",
        outline: "border-haze text-ink",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
