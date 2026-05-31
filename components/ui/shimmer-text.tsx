import { cn } from "@/lib/utils";

/**
 * Claude-style loading text: a soft highlight sweeps left-to-right across the
 * letters on a muted base color. Use for in-progress status lines.
 */
export function ShimmerText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block animate-text-shimmer bg-clip-text text-transparent",
        "bg-[length:200%_100%] bg-gradient-to-r",
        "from-muted-foreground/40 via-foreground to-muted-foreground/40",
        className,
      )}
    >
      {children}
    </span>
  );
}
