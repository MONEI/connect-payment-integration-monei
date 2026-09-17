import type { MoneiSdk } from "./types";

export const MONEI_JS_URL = "https://js.monei.com/v3/monei.js";

let loading: Promise<MoneiSdk> | undefined;

/**
 * Loads MONEI.js from js.monei.com (it must never be bundled or self-hosted — that is a PCI requirement
 * and how MONEI ships fixes to every merchant at once). Idempotent.
 */
export function loadMonei(src: string = MONEI_JS_URL): Promise<MoneiSdk> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("MONEI.js can only be loaded in a browser"));
  }
  if (window.monei) return Promise.resolve(window.monei);
  if (loading) return loading;

  loading = new Promise<MoneiSdk>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    const script = existing ?? document.createElement("script");
    const onLoad = () => {
      if (window.monei) resolve(window.monei);
      else reject(new Error("MONEI.js loaded but window.monei is undefined"));
    };
    const onError = () => {
      loading = undefined;
      reject(new Error("Failed to load MONEI.js"));
    };
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return loading;
}

/** Test hook. */
export function resetMoneiLoader(): void {
  loading = undefined;
}
