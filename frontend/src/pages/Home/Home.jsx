import React, { useEffect } from 'react';
import HeroSection from './components/01.HeroSection';
import Marquee1Section from './components/02.Marquee1Section';
import ServicesSection from './components/03.ServicesSection';
import ApproachNoteSection from './components/04.ApproachNoteSection';
import ContactSection from './components/05.ContactSection';
import SiteFooter from './components/06.SiteFooter';

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
      <ServicesSection onNavigate={onNavigate} />
      <ApproachNoteSection />
      <ContactSection onNavigate={onNavigate} />
      <SiteFooter onNavigate={onNavigate} />
    </main>
  );
}
