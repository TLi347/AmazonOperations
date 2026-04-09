import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#1a1a1a] text-white hover:bg-[#2a2a2a]",
        secondary: "bg-[#f5f4f2] text-[#1a1a1a] hover:bg-[#eae8e4]",
        ghost: "hover:bg-[#eae8e4] text-[#737373] hover:text-[#1a1a1a]",
        outline: "border border-[#e8e5e0] hover:bg-[#eae8e4] text-[#737373]",
        pill: "rounded-full border border-[#e8e5e0] hover:bg-[#eae8e4] text-[#737373]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-7 px-3 text-xs",
        lg: "h-11 px-6",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
