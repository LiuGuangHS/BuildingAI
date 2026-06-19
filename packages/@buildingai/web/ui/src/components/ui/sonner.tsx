"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useTheme } from "./../theme-provider";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <ToastStatusIcon tone="success" label="成功" />,
        info: <ToastStatusIcon tone="info" label="提示" />,
        warning: <ToastStatusIcon tone="warning" label="警告" />,
        error: <ToastStatusIcon tone="error" label="错误" />,
        loading: <ToastStatusIcon tone="loading" label="加载中" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

function ToastStatusIcon({
  tone,
  label,
}: {
  tone: "success" | "info" | "warning" | "error" | "loading";
  label: string;
}) {
  const glyph = tone === "success" ? "✓" : tone === "info" ? "i" : tone === "warning" ? "!" : "×";

  return (
    <span
      aria-label={label}
      role="img"
      data-tone={tone}
      className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] leading-none font-bold text-primary-foreground data-[tone=error]:bg-destructive data-[tone=info]:bg-sky-500 data-[tone=loading]:animate-spin data-[tone=loading]:border-2 data-[tone=loading]:border-primary data-[tone=loading]:border-t-transparent data-[tone=loading]:bg-transparent data-[tone=loading]:text-transparent data-[tone=warning]:bg-amber-500"
    >
      {tone === "loading" ? null : glyph}
    </span>
  );
}

export { Toaster };
