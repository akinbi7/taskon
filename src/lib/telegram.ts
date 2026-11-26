import WebApp from "@twa-dev/sdk";

export const isTelegram = (): boolean => {
  try {
    return Boolean(WebApp.initData);
  } catch {
    return false;
  }
};

export const getInitData = (): string => {
  try {
    return WebApp.initData || "";
  } catch {
    return "";
  }
};

const PAPER = "#f3ecdf";
const DEEP = "#1b1713";

function syncInsets() {
  try {
    const safeArea = WebApp.safeAreaInset;
    const contentArea = WebApp.contentSafeAreaInset;
    const top = Math.max(safeArea?.top ?? 0, contentArea?.top ?? 0);
    const bottom = Math.max(safeArea?.bottom ?? 0, contentArea?.bottom ?? 0);
    document.documentElement.style.setProperty("--tg-safe-top", `${top}px`);
    document.documentElement.style.setProperty("--tg-safe-bottom", `${bottom}px`);
  } catch {
    /* browsers without safe area data */
  }
}

export function applyTheme(): "light" | "dark" {
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  let scheme: "light" | "dark" = prefersDark ? "dark" : "light";
  try {
    // Outside Telegram the SDK still reports "light"; follow the browser there.
    if (WebApp.initData && (WebApp.colorScheme === "dark" || WebApp.colorScheme === "light")) {
      scheme = WebApp.colorScheme;
    }
  } catch {
    /* ignore */
  }

  const color = scheme === "dark" ? DEEP : PAPER;
  document.documentElement.dataset.theme = scheme;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = color;

  try {
    if (WebApp.initData) {
      WebApp.setHeaderColor(color);
      WebApp.setBackgroundColor(color);
      WebApp.setBottomBarColor?.(color);
    }
  } catch {
    /* older Telegram versions */
  }

  return scheme;
}

export function initTelegramChrome() {
  try {
    if (WebApp.initData) {
      WebApp.ready();
      WebApp.expand();
      WebApp.disableVerticalSwipes?.();
    }
  } catch {
    /* previewing outside Telegram is fine */
  }

  applyTheme();
  syncInsets();

  try {
    WebApp.onEvent("themeChanged", () => applyTheme());
    WebApp.onEvent("viewportChanged", syncInsets);
    WebApp.onEvent("safeAreaChanged", syncInsets);
    WebApp.onEvent("contentSafeAreaChanged", syncInsets);
  } catch {
    /* ignore */
  }

  try {
    window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => applyTheme());
  } catch {
    /* older webviews */
  }
}

export function haptic(kind: "light" | "success" | "warning" = "light") {
  try {
    if (kind === "success") {
      WebApp.HapticFeedback.notificationOccurred("success");
    } else if (kind === "warning") {
      WebApp.HapticFeedback.notificationOccurred("warning");
    } else {
      WebApp.HapticFeedback.impactOccurred("light");
    }
  } catch {
    /* no haptics in the browser */
  }
}

export function openLink(url: string) {
  try {
    if (WebApp.initData && WebApp.openLink) {
      WebApp.openLink(url);
      return;
    }
  } catch {
    /* fall through */
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function shareLink(link: string, text: string) {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
  try {
    if (WebApp.initData && WebApp.openTelegramLink) {
      WebApp.openTelegramLink(shareUrl);
      return;
    }
  } catch {
    /* fall through */
  }
  window.open(shareUrl, "_blank", "noopener,noreferrer");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      textarea.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function closeApp() {
  try {
    WebApp.close();
  } catch {
    /* ignore */
  }
}
