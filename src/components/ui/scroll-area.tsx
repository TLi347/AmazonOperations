"use client";

import { cn } from "@/lib/utils";

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  maxHeight?: string | number;
}

function ScrollArea({ className, maxHeight, style, children, ...props }: ScrollAreaProps) {
  return (
    <div
      className={cn("overflow-y-auto", className)}
      style={{
        maxHeight,
        scrollbarWidth: "thin",
        scrollbarColor: "#d4d4d4 transparent",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export { ScrollArea };
