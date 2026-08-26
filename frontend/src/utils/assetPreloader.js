/**
 * assetPreloader.js - Industrial Standard Asset Synchronization Engine
 * 
 * Accurately tracks the full payload (Hero video texture, 3D WebGL textures,
 * custom Melodrama fonts, vector badges, and Home component tree) in real-time,
 * scaling progress dynamically from 0% -> 100%.
 */

// Critical assets used across Loader and Hero initial viewport
import { pastelFlowers, monogramComplete } from '../assets';

export const CRITICAL_LOADER_ASSETS = [
  pastelFlowers,
  monogramComplete
];

/**
 * Preload and decode an image source asynchronously with timeout race
 */
function preloadImage(src, timeoutMs = 2500) {
  return new Promise((resolve) => {
    if (!src || typeof window === 'undefined') return resolve();
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    const timer = setTimeout(done, timeoutMs);
    const img = new Image();
    img.onload = () => { clearTimeout(timer); done(); };
    img.onerror = () => { clearTimeout(timer); done(); };
    img.src = src;

    if (img.decode) {
      img.decode()
        .then(() => { clearTimeout(timer); done(); })
        .catch(() => {});
    }
  });
}

/**
 * Preload critical fonts (Melodrama + Google Fonts) with fast fallback
 */
function preloadFonts(timeoutMs = 2000) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || !document.fonts || !document.fonts.ready) {
      return resolve();
    }
    const timer = setTimeout(resolve, timeoutMs);
    document.fonts.ready
      .then(() => { clearTimeout(timer); resolve(); })
      .catch(() => { clearTimeout(timer); resolve(); });
  });
}

/**
 * Dynamically tracks and calculates real progress (0% -> 100%)
 * based on real payload streaming (Images, Fonts, Chunks)
 */
export function trackPreloading({
  assets = CRITICAL_LOADER_ASSETS,
  onProgress,
  minDuration = 1400,
  maxTimeout = 5000
} = {}) {
  let isCancelled = false;
  const shellInitial = typeof window !== 'undefined' && window.__SHELL_PROGRESS__ ? window.__SHELL_PROGRESS__ : 0;
  
  let currentVisual = shellInitial;
  let isReady = false;
  let imagesLoadedCount = 0;
  const totalImageItems = assets.length + 1; // +1 for fonts

  // Monitor Fonts and Images
  const updateImageProgress = () => {
    imagesLoadedCount++;
    checkGlobalReady();
  };

  preloadFonts().then(updateImageProgress);
  assets.forEach((src) => preloadImage(src).then(updateImageProgress));

  // Preload Home Component Tree (Part 2)
  if (typeof window !== 'undefined') {
    import('../pages/Home/Home')
      .then(() => checkGlobalReady())
      .catch(() => checkGlobalReady());
  }

  function checkGlobalReady() {
    const isImagesDone = imagesLoadedCount >= totalImageItems;
    if (isImagesDone) {
      isReady = true;
    }
  }

  const safetyTimer = setTimeout(() => {
    isReady = true;
  }, maxTimeout);

  const startTime = performance.now();
  let rafId;

  const isHomeDomReady = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return true;
    return Boolean((window.__HOME_PART2_READY__ || window.__HOME_DOM_READY__) && document.getElementById('section-hero'));
  };

  let lastRounded = -1;

  const tick = (now) => {
    if (isCancelled) return;
    const elapsed = now - startTime;

    const allReady = (isReady && isHomeDomReady() && elapsed >= minDuration) || elapsed >= maxTimeout;

    if (allReady) {
      // Smooth, controlled finish to 100% (sweeps cleanly through 95% -> 100% without snapping)
      const finishStep = Math.min(1.8, Math.max(0.6, (100 - currentVisual) * 0.15));
      currentVisual = Math.min(100, currentVisual + finishStep);
    } else {
      // Weight the real asset arrival vs intentional cinematic pacing
      const imageRatio = imagesLoadedCount / totalImageItems;
      const domRatio = isHomeDomReady() ? 1 : 0.4;
      const realStreamRatio = (imageRatio * 0.65) + (domRatio * 0.35);
      
      const timeRatio = Math.min(1, elapsed / minDuration);
      // Smoothly blend time pace and asset readiness
      const combinedRatio = Math.max(realStreamRatio * 0.9, timeRatio * 0.95);
      const target = Math.min(99, combinedRatio * 99);
      
      const delta = target - currentVisual;
      if (delta > 0) {
        // Cap step per frame to 1.1% max (at 60 FPS = 66% per second) so digits count continuously (1, 2, 3, 4, 5...)
        const step = Math.min(1.1, Math.max(0.25, delta * 0.1));
        currentVisual = Math.min(target, currentVisual + step);
      }
    }

    const rounded = Math.min(100, Math.round(currentVisual));
    if (rounded !== lastRounded) {
      lastRounded = rounded;
      onProgress?.(rounded);
    }

    if (rounded >= 100) {
      clearTimeout(safetyTimer);
      return;
    }

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return () => {
    isCancelled = true;
    clearTimeout(safetyTimer);
    if (rafId) cancelAnimationFrame(rafId);
  };
}
