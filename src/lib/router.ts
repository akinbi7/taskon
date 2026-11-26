import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function currentPath(): string {
  return window.location.pathname.replace(/\/+$/, "") || "/";
}

export function navigate(to: string) {
  const target = to.startsWith("/") ? to : `/${to}`;
  if (currentPath() !== target) {
    window.history.pushState({}, "", target);
  }
  listeners.forEach((listener) => listener());
  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, currentPath, () => "/");
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    listeners.forEach((listener) => listener());
  });
}
