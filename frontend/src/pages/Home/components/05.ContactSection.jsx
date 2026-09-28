import React from 'react';

export default function ContactSection({ onNavigate }) {
  return (
    <section id="section-cta" className="w-screen px-6 pb-32 text-[#434343] md:px-12 md:pb-52" aria-labelledby="contact-heading">
      <div className="border-t border-black/20 pt-5">
        <div className="flex items-center justify-between text-sm tracking-tight">
          <h2 id="contact-heading">Contact</h2>
          <span>Open for the right problem</span>
        </div>
        <p className="mt-8 max-w-2xl text-2xl leading-tight tracking-tight md:text-5xl">
          Have a product, workflow, or interface to figure out?
        </p>
        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <button type="button" onClick={() => onNavigate?.('contact')} className="border-b border-[#434343] pb-1 transition-transform duration-300 hover:translate-x-1">
            Start a conversation -&gt;
          </button>
          <button type="button" onClick={() => onNavigate?.('work')} className="border-b border-[#434343] pb-1 transition-transform duration-300 hover:translate-x-1">
            View work -&gt;
          </button>
        </div>
      </div>
    </section>
  );
}