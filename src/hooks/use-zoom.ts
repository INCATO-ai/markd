import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "markd-zoom";
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const STEP = 10;
const DEFAULT_ZOOM = 100;

function getInitial(): number {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const n = parseInt(stored, 10);
    if (!isNaN(n) && n >= MIN_ZOOM && n <= MAX_ZOOM) return n;
  }
  return DEFAULT_ZOOM;
}

export function useZoom() {
  const [zoom, setZoom] = useState<number>(getInitial);

  useEffect(() => {
    const basePx = 16;
    document.documentElement.style.setProperty(
      "--font-size",
      `${(basePx * zoom) / 100}px`,
    );
  }, [zoom]);

  const update = useCallback((next: number) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    setZoom(clamped);
    localStorage.setItem(STORAGE_KEY, String(clamped));
  }, []);

  const zoomIn = useCallback(() => setZoom((z) => {
    const next = Math.min(MAX_ZOOM, z + STEP);
    localStorage.setItem(STORAGE_KEY, String(next));
    return next;
  }), []);

  const zoomOut = useCallback(() => setZoom((z) => {
    const next = Math.max(MIN_ZOOM, z - STEP);
    localStorage.setItem(STORAGE_KEY, String(next));
    return next;
  }), []);

  const resetZoom = useCallback(() => update(DEFAULT_ZOOM), [update]);

  return { zoom, zoomIn, zoomOut, resetZoom };
}
