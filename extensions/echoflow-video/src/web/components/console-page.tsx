import { type ReactNode } from "react";

import { cn } from "@buildingai/ui/lib/utils";

export function ConsolePage({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("mx-auto flex w-full max-w-[1480px] flex-col gap-5 p-3 md:p-4", className)}>
            {children}
        </div>
    );
}
