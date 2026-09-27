import type { ReactNode } from "react";
import * as ScrollPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

export function ScrollArea({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <ScrollPrimitive.Root className={cn("overflow-hidden", className)}>
      <ScrollPrimitive.Viewport className="h-full w-full">
        {children}
      </ScrollPrimitive.Viewport>
      <ScrollPrimitive.Scrollbar
        orientation="vertical"
        className="flex w-2 touch-none p-0.5 select-none"
      >
        <ScrollPrimitive.Thumb className="relative flex-1 rounded-full bg-border-strong" />
      </ScrollPrimitive.Scrollbar>
    </ScrollPrimitive.Root>
  );
}
