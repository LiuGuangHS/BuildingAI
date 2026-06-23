export type ExtensionConsoleMenuIconName =
  | "bar-chart-3"
  | "bell"
  | "bot"
  | "brush"
  | "calendar"
  | "clapperboard"
  | "circle-help"
  | "file-text"
  | "history"
  | "image"
  | "key-round"
  | "landmark"
  | "layout-dashboard"
  | "list"
  | "list-checks"
  | "settings"
  | "settings-2"
  | "shield"
  | "shield-check"
  | "sparkles"
  | "users"
  | "video"
  | "wallet-cards";

export type ExtensionMenuItem = {
  title: string;
  path: string;
  icon?: ExtensionConsoleMenuIconName;
  children?: ExtensionMenuItem[];
};
