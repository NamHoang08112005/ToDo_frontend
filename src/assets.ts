declare global {
  interface Window {
    frameflowAssets?: Record<string, string>;
  }
}
export function asset(path: string) {
  return window.frameflowAssets?.[path] || path;
}
