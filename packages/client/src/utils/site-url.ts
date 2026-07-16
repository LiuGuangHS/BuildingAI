export function siteUrl(path = "/"): string {
  return new URL(path, `${window.location.origin}/`).toString();
}
