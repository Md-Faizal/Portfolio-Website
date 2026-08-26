import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import PageHeader from '../../../components/common/PageHeader';
import heroStockVideo from '../../../assets/videos/16132994_3840_2160_60fps.mp4';

const THEME_COLOR = '#A30033'; // Deep crimson red matching the logo

const MONOGRAM_PATHS = {
  wingDown: "M43.82,70.3l64.52.05,5.42-12.76-32.78-.36,41.09-19.08,7.56-18.43,27.69.85-25.84,61.15c-2.63,6.23-11.43,8.64-18.18,8.65l-111.12.13,41.64-20.2Z",
  wingUp: "M129.63,19.71l-65.22.74-5.49,12.65,32.87.55-41.14,19.05-6.83,17.6-28.38-.02L41.22,9.13C43.67,3.32,52.08.55,58.48.55l110.96-.05-39.82,19.21Z",
  centerPoly: "44.55 69.8 51.04 53.07 93.98 33.19 59.67 32.61 64.74 20.95 128.88 20.22 121.68 37.77 78.77 57.7 113 58.08 108.01 69.85 44.55 69.8",
  centerWhite: "M128.13,20.73l-6.84,16.67-40.73,18.92-4,1.86,4.41.05,31.28.34-4.57,10.78-62.4-.05,6.16-15.86,40.77-18.88,3.96-1.83-4.36-.07-31.37-.53,4.64-10.68,63.06-.71M129.63,19.71l-65.22.74-5.49,12.65,32.87.55-41.14,19.05-6.83,17.6,64.52.05,5.42-12.76-32.78-.36,41.09-19.08,7.56-18.43h0Z"
};

// Exact geometric calculation: SVG is 215vmin wide with viewBox 800.
// Innermost circle has radius 148 in 800x800 coordinate system.
// Exact radius in vmin = 148 * (215 / 800) = 39.775vmin.
const INNER_PORTAL_RADIUS_VMIN = "39.775vmin";

function ConcentricBackground({ 
  isRevealed = true, 
  isTransitioning = false,
  heroStage = 'logo' // 'logo' | 'video-portal' | 'video-fullscreen'
}) {
  const isRadiating = isRevealed;
  const isStableView = isTransitioning;
  // Strictly gate portal and fullscreen states so transitions never glitch or punch holes
  const isFullscreenVideo = !isTransitioning && heroStage === 'video-fullscreen';
  const isPortalActive = !isTransitioning && (heroStage === 'video-portal' || heroStage === 'video-fullscreen');
  
  const centerX = 400, centerY = 400;
  const ringCount = 40;
  const maxRadius = 390;
  const minRadius = 148; // Large middle circle framing the logo & portal matching reference

  const rings = [];
  for (let i = 0; i < ringCount; i++) {
    const t = i / (ringCount - 1);
    const radius = minRadius + t * (maxRadius - minRadius);

    // slight center drift so rings aren't perfectly concentric
    const drift = 10 * Math.sin(t * Math.PI);
    const cx = centerX + drift;
    const cy = centerY - drift * 0.3;

    // Thinner alternating rings with high-density texture matching reference
    const isLight = i % 2 === 0;
    const stroke = isLight ? "rgba(255,255,255,0.9)" : "rgba(138,146,158,0.42)";
    const strokeWidth = isLight ? 1.6 : 1.0;
    const edgeFade = 1 - Math.pow(t, 2) * 0.55;

    rings.push({
      index: i,
      t,
      cx,
      cy,
      radius,
      stroke,
      strokeWidth,
      targetOpacity: Number(edgeFade.toFixed(2))
    });
  }

  return (
    <div 
      className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden flex items-center justify-center"
    >
      <svg 
        viewBox="0 0 800 800" 
        className="absolute pointer-events-none"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '215vmin',
          height: '215vmin'
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Porcelain Studio Base Radial Gradient */}
          <radialGradient id="porcelain-studio-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f6f8fb" />
            <stop offset="45%" stopColor="#edf0f5" />
            <stop offset="80%" stopColor="#E5E8ED" />
            <stop offset="100%" stopColor="#d8dde5" />
          </radialGradient>

          {/* Soft Directional Sheen */}
          <linearGradient id="porcelain-sheen-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
            <stop offset="45%" stopColor="rgba(255,255,255,0)" />
            <stop offset="55%" stopColor="rgba(0,0,0,0.02)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.6)" />
          </linearGradient>

          {/* Soft Edge Vignette */}
          <radialGradient id="porcelain-vignette-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0)" />
            <stop offset="80%" stopColor="rgba(210,213,218,0.2)" />
            <stop offset="100%" stopColor="rgba(180,186,195,0.35)" />
          </radialGradient>

          {/* Concentric Ridge Micro Drop Shadow Filter */}
          <filter id="groove-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0.5" dy="1" stdDeviation="0.8" floodColor="rgba(0,0,0,0.06)" />
          </filter>

          {/* DYNAMIC CONCENTRIC APERTURE MASK: 
              - White = visible porcelain canvas
              - Black = cutout hole revealing video underneath
              - Stage 1 (logo): 100% white porcelain canvas
              - Stage 2 (video-portal): Center circle (r=148) turns black, opening the center video portal
              - Stage 3 (video-fullscreen): Each ring band from i=0 to i=39 expands to black sequentially,
                dissolving the porcelain band-by-band into the full video frame
          */}
          <mask id="porcelain-aperture-mask">
            {/* Base White Canvas = 100% Opaque Porcelain Background */}
            <rect x="-1000" y="-1000" width="2800" height="2800" fill="#ffffff" />

            {/* Center Portal Cutout: radius = 148 (matches innermost ring 0 exactly) */}
            <motion.circle
              cx={centerX}
              cy={centerY}
              r={minRadius}
              fill="#000000"
              initial={false}
              animate={{
                opacity: isPortalActive ? 1 : 0
              }}
              transition={{
                duration: isStableView ? 0 : 0.5,
                ease: [0.16, 1, 0.3, 1]
              }}
            />

            {/* Concentric Aperture Unmasking Bands:
                Each band i unmasks the porcelain between ring i and ring i+1
                starting from innermost ring (i=0) to outermost (i=39)
            */}
            {rings.map((ring, i) => {
              const nextRadius = rings[i + 1] ? rings[i + 1].radius : 1600;
              // Synchronized with ring collapse delay
              const bandUnmaskDelay = 0.05 + i * 0.028;

              return (
                <motion.circle
                  key={`mask-band-${i}`}
                  cx={ring.cx}
                  cy={ring.cy}
                  r={nextRadius}
                  fill="#000000"
                  initial={false}
                  animate={{
                    opacity: isFullscreenVideo ? 1 : 0
                  }}
                  transition={{
                    duration: isStableView ? 0 : (isFullscreenVideo ? 0.32 : 0),
                    delay: isStableView ? 0 : (isFullscreenVideo ? bandUnmaskDelay : 0),
                    ease: [0.22, 1, 0.36, 1]
                  }}
                />
              );
            })}
          </mask>
        </defs>

        {/* 1. MASKED PORCELAIN STUDIO BACKGROUND LAYERS */}
        <g mask="url(#porcelain-aperture-mask)">
          {/* Porcelain studio base */}
          <rect x="-1000" y="-1000" width="2800" height="2800" fill="url(#porcelain-studio-gradient)" />
          {/* Soft directional sheen */}
          <rect x="-1000" y="-1000" width="2800" height="2800" fill="url(#porcelain-sheen-gradient)" opacity="0.4" />
          {/* Soft edge vignette */}
          <rect x="-1000" y="-1000" width="2800" height="2800" fill="url(#porcelain-vignette-gradient)" />
        </g>

        {/* 2. THE 40 CONCENTRIC DEPTH RINGS (Carved onto Porcelain Surface) */}
        <g 
          fill="none" 
          filter="url(#groove-shadow)"
          style={{
            animation: 'heroSpin 40s linear infinite',
            transformOrigin: '400px 400px'
          }}
        >
          {rings.map((ring) => {
            // 1. Initial reveal wave: radiates from innermost ring (i=0) -> outermost ring (i=ringCount-1)
            const appearDelay = 0.05 + ring.index * 0.026;
            // 2. Inverse dissolution wave: collapses into porcelain starting from innermost (i=0) -> outermost (i=ringCount-1)
            const collapseDelay = 0.05 + ring.index * 0.028;

            const shouldShowRing = isStableView || (isRadiating && !isFullscreenVideo);

            return (
              <motion.circle
                key={`ring-${ring.index}`}
                cx={ring.cx}
                cy={ring.cy}
                r={ring.radius}
                stroke={ring.stroke}
                initial={isStableView ? false : {
                  opacity: 0,
                  strokeWidth: 0
                }}
                animate={shouldShowRing ? {
                  opacity: ring.targetOpacity,
                  strokeWidth: ring.strokeWidth
                } : {
                  opacity: 0,
                  strokeWidth: 0
                }}
                transition={{
                  duration: isStableView ? 0 : (shouldShowRing ? 0.75 : 0.32),
                  delay: isStableView ? 0 : (shouldShowRing ? appearDelay : collapseDelay),
                  ease: [0.22, 1, 0.36, 1]
                }}
              />
            );
          })}
        </g>
      </svg>

      <style>{`
        @keyframes heroSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          svg g { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

export default function HeroSection({ 
  isRevealed, 
  onOpenMenu, 
  isMenuOpen, 
  onNavigate, 
  onLogoClick,
  isTransitioning = false,
  isPageReady = true
}) {
  // Master Choreography Stages:
  // 1. 'logo': (0s - 1.8s) Concentric rings radiate out + red logo in center
  // 2. 'video-portal': (1.8s - 5.8s, 4.0s duration) Red logo fades out; stock video plays inside center circle portal for 4 seconds
  // 3. 'video-fullscreen': (5.8s+) Concentric circles dissolve in reverse from innermost to outermost circle, revealing the full video frame
  const [heroStage, setHeroStage] = useState('logo');
  const [headerLogoStage, setHeaderLogoStage] = useState('hidden'); // 'hidden' | 'red' | 'lime'
  const videoRef = useRef(null);

  // Guarantee continuous, muted, non-blocked video playback
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.defaultMuted = true;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          const retryPlay = () => {
            video.play().catch(() => {});
            window.removeEventListener('click', retryPlay);
            window.removeEventListener('touchstart', retryPlay);
          };
          window.addEventListener('click', retryPlay, { once: true });
          window.addEventListener('touchstart', retryPlay, { once: true });
        });
      }
    }
  }, []);

  useEffect(() => {
    // If mid-transition or not yet revealed, reset to initial logo stage
    if (!isRevealed || isTransitioning) {
      setHeroStage('logo');
      setHeaderLogoStage('hidden');
      return;
    }

    // Timeline Sequence:
    // T = 1.8s: Red logo disappears; video portal opens & top-left header logo emerges
    const portalTimer = setTimeout(() => {
      setHeroStage('video-portal');
      setHeaderLogoStage('red');
      if (videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
    }, 1800);

    // T = 2.4s: Top-left header logo transitions from red to lime
    const limeLogoTimer = setTimeout(() => {
      setHeaderLogoStage('lime');
    }, 2400);

    // T = 5.8s (1.8s + 4.0s of video inside circular portal):
    // Concentric circles dissolve in reverse from inside to outside, revealing full video frame!
    const fullscreenVideoTimer = setTimeout(() => {
      setHeroStage('video-fullscreen');
    }, 5800);

    return () => {
      clearTimeout(portalTimer);
      clearTimeout(limeLogoTimer);
      clearTimeout(fullscreenVideoTimer);
    };
  }, [isRevealed, isTransitioning]);

  const showCenterLogo = isRevealed && (isTransitioning || heroStage === 'logo');
  const showTopLeftLogo = isRevealed && !isTransitioning && (headerLogoStage === 'red' || headerLogoStage === 'lime');

  const isFullscreen = !isTransitioning && heroStage === 'video-fullscreen';
  const isVideoActive = isRevealed && !isTransitioning && (heroStage === 'video-portal' || heroStage === 'video-fullscreen');

  return (
    <section
      id="section-hero"
      className="relative w-screen h-svh md:h-screen flex items-center justify-center overflow-hidden bg-[#E5E8ED]"
      style={{
        position: 'relative',
        width: '100vw',
        minHeight: '100vh',
        backgroundColor: '#E5E8ED',
        overflow: 'hidden'
      }}
    >
      {/* 1. CINEMATIC 4K VIDEO (Playing behind porcelain SVG aperture mask) */}
      <div
        className="absolute inset-0 w-full h-full z-0 flex items-center justify-center overflow-hidden pointer-events-none"
        style={{
          opacity: isRevealed && !isTransitioning ? 1 : 0,
          transition: isTransitioning ? 'none' : 'opacity 0.4s ease'
        }}
      >
        <video
          ref={videoRef}
          src={heroStockVideo}
          className="w-full h-full object-cover select-none pointer-events-none"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
        >
          <source src={heroStockVideo} type="video/mp4" />
        </video>
      </div>

      {/* 2. CONCENTRIC PORCELAIN BACKGROUND & DEPTH CIRCLES WITH STEP-BY-STEP APERTURE MASK */}
      <div className="absolute inset-0 w-full h-full z-10 pointer-events-none">
        <ConcentricBackground 
          isRevealed={isRevealed} 
          isTransitioning={isTransitioning}
          heroStage={heroStage}
        />
      </div>

      {/* 3. MAIN CENTER RED MONOGRAM LOGO */}
      <motion.div 
        initial={false}
        animate={{ 
          opacity: showCenterLogo ? 1 : 0, 
          scale: showCenterLogo ? 1 : 0.92,
          y: showCenterLogo ? 0 : -8
        }}
        transition={{ 
          duration: showCenterLogo ? (isTransitioning ? 0 : 0.4) : 0.65, 
          ease: [0.16, 1, 0.3, 1] 
        }}
        style={{ 
          position: 'relative', 
          zIndex: 30, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          pointerEvents: showCenterLogo ? 'auto' : 'none'
        }}
      >
        <div style={{ width: 'clamp(180px, 22vw, 320px)', height: 'clamp(95px, 11.6vw, 170px)' }}>
          <svg viewBox="0 0 171.63 91" className="w-full h-full" style={{ overflow: 'visible' }}>
            <path d={MONOGRAM_PATHS.wingDown} fill={THEME_COLOR} />
            <path d={MONOGRAM_PATHS.wingUp} fill={THEME_COLOR} />
            <polygon points={MONOGRAM_PATHS.centerPoly} fill={THEME_COLOR} />
            <path d={MONOGRAM_PATHS.centerWhite} fill="#ffffff" />
          </svg>
        </div>
      </motion.div>

      {/* 4. PAGE HEADER (Top-Left Brand Logo & Menu Button) */}
      <div className="absolute top-0 left-0 w-full z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <PageHeader 
            isMenuOpen={isMenuOpen}
            onOpenMenu={onOpenMenu}
            onNavigate={onNavigate}
            onLogoClick={onLogoClick}
            currentPage="home"
            isTransitioning={isTransitioning}
            isPageReady={isPageReady}
            showHomeLogo={showTopLeftLogo}
            logoColorStage={headerLogoStage === 'lime' ? 'lime' : 'red'}
          />
        </div>
      </div>
    </section>
  );
}

