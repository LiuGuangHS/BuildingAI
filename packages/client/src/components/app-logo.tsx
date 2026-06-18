import { useConfigStore } from "@buildingai/stores";
import { cn } from "@buildingai/ui/lib/utils";

const AppLogo = ({
  showAppName = true,
  desc,
  className,
}: {
  showAppName?: boolean;
  desc?: React.ReactNode | string;
  className?: string;
}) => {
  const { websiteConfig } = useConfigStore((state) => state.config);

  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      <>
        {websiteConfig?.webinfo.logo ? (
          <img
            className="h-10 shrink-0"
            src={websiteConfig?.webinfo.logo}
            alt={websiteConfig?.webinfo.name}
          />
        ) : (
          <img className="h-10 w-auto shrink-0 object-contain" src="/logo-full.png" alt="清云AI" />
        )}
      </>
      {showAppName && (
        <div className="flex flex-col justify-center gap-0.5">
          <span className="line-clamp-1 text-lg leading-[1.2] font-bold">
            {websiteConfig?.webinfo.name}
          </span>
          {desc && typeof desc === "string" ? (
            <span className="text-muted-foreground text-xs">{desc}</span>
          ) : (
            desc
          )}
        </div>
      )}
    </div>
  );
};

export default AppLogo;
