// Copied from shadcn/ui (Badge), without the Radix `asChild` slot we don't use.
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        outline: "text-foreground",
        destructive: "border-destructive/30 text-destructive",
        muted: "text-muted-foreground",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);

export function Badge({ className, variant, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
