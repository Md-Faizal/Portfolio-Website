import React, { useEffect } from 'react';
import HeroSection from './components/HeroSection';
import Marquee1Section from './components/Marquee1Section';
import ProjectsSection from './components/ProjectsSection';
import ProofSection from './components/ProofSection';
import Marquee2Section from './components/Marquee2Section';
import ServicesSection from './components/ServicesSection';
import QuoteSection from './components/QuoteSection';
import ReelSection from './components/ReelSection';
import CtaSection from './components/CtaSection';
import ShowcaseSection from './components/ShowcaseSection';

export default function Home({ 
  isRevealed, 
  onOpenMenu, 
  isMenuOpen, 
  onNavigate,
  onLogoClick,
  isTransitioning = false,
  isPageReady = true
}) {
  useEffect(() => {
    document.title = 'Mohammad Faizal';
    if (typeof window !== 'undefined') {
      window.__HOME_PART2_READY__ = true;
      window.__HOME_DOM_READY__ = true;
      window.dispatchEvent(new CustomEvent('home-part2-ready'));
      window.dispatchEvent(new CustomEvent('home-dom-ready'));
    }
  }, []);

  return (
    <main className="pb-38 md:pb-64 w-screen overflow-x-hidden">
      <h1 className="sr-only">Mohammad Faizal</h1>
      
      <div id="section-hero">
        <HeroSection 
          isRevealed={isRevealed} 
          onOpenMenu={onOpenMenu}
          isMenuOpen={isMenuOpen}
          onNavigate={onNavigate}
          onLogoClick={onLogoClick}
          isTransitioning={isTransitioning}
          isPageReady={isPageReady}
        />
      </div>
      
      <div id="section-marquee1">
        <Marquee1Section />
      </div>

      <div id="section-projects">
        <ProjectsSection />
      </div>

      <div id="section-proof">
        <ProofSection />
      </div>

      <div id="section-marquee2">
        <Marquee2Section />
      </div>

      <div id="section-services">
        <ServicesSection />
      </div>

      <div id="section-quote">
        <QuoteSection />
      </div>

      {/* Custom Cursor / Bubble */}
      <div className="fixed z-100 hidden size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#434343]/20 bg-white text-[#434343] shadow-[0_0_0_3px_#fff] pointer-events-none transition-[opacity,scale] duration-300 ease-in-out-expo md:flex scale-10 opacity-0"></div>

      <div id="section-reel">
        <ReelSection />
      </div>

      <div id="section-cta">
        <CtaSection />
      </div>

      <div id="section-showcase">
        <ShowcaseSection />
      </div>
    </main>
  );
}
