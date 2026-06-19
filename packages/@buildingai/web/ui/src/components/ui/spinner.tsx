import { cn } from "@buildingai/ui/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "border-current/30 border-t-current inline-block size-4 animate-spin rounded-full border-2",
        className,
      )}
      {...props}
    />
  );
}

export { Spinner };
