export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Try to open a deeplink (e.g. dianping://...). If the app isn't installed,
 * fall back to the web URL after ~1.5s (page is still in foreground = no jump happened).
 */
export function openDeeplink(deeplink: string, webFallback: string): void {
  if (typeof window === "undefined") return;

  if (!isMobile()) {
    window.open(webFallback, "_blank", "noopener,noreferrer");
    return;
  }

  const start = Date.now();
  const fallbackTimer = window.setTimeout(() => {
    if (Date.now() - start < 2000 && document.visibilityState === "visible") {
      window.location.href = webFallback;
    }
  }, 1500);

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      window.clearTimeout(fallbackTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  window.location.href = deeplink;
}
