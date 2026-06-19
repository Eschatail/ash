/**
 * Project a normalized viewport anchor (0..1) to world coords on the
 * companion canvas, given a fixed camera at z=8 with vertical fov 35°.
 */
export function viewportToWorld(
  anchor: { x: number; y: number },
  width: number,
  height: number,
) {
  const ndcX = anchor.x * 2 - 1;
  const ndcY = -(anchor.y * 2 - 1);
  const fovRad = (35 * Math.PI) / 180;
  const distance = 8;
  const heightAtZ = 2 * Math.tan(fovRad / 2) * distance;
  const aspect = width / Math.max(height, 1);
  const widthAtZ = heightAtZ * aspect;
  return {
    x: ndcX * (widthAtZ / 2),
    y: ndcY * (heightAtZ / 2),
    z: 0,
  };
}

export function isMobile() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
}

export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function detectWebGL(): boolean {
  if (typeof document === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

export function detectQualityTier(): "ultra" | "high" | "medium" | "low" {
  if (typeof navigator === "undefined") return "high";
  // @ts-expect-error - non-standard
  const memory = navigator.deviceMemory as number | undefined;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (isMobile()) return "low";
  if (memory && memory < 4) return "low";
  if (cores < 4) return "medium";
  if (cores >= 8 && (!memory || memory >= 8)) return "ultra";
  return "high";
}
