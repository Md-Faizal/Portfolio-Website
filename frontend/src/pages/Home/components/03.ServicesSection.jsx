import React from 'react';

const services = [
  {
    number: '01',
    title: 'Web applications',
    preview: 'MacOS for Web',
    description: 'Desktop-like browser experiences, application shells, and responsive product interfaces.'
  },
  {
    number: '02',
    title: 'CRM / ERP workflows',
    preview: 'Business system inside MacOS for Web',
    description: 'Structured dashboards, connected data views, and practical workflows for complex products.'
  },
  {
    number: '03',
    title: 'Native Android',
    preview: 'ERP Companion',
    description: 'Kotlin applications with Material 3 foundations and mobile-first interaction patterns.'
  },
  {
    number: '04',
    title: 'Interface systems',
    preview: 'Shared across both products',
    description: 'Reusable components, visual rules, and interaction details that keep a product coherent.'
  }
];

export default function ServicesSection({ onNavigate }) {
  return (
    <section id="section-services" className="w-screen px-6 pb-28 text-[#434343] md:px-12 md:pb-44" aria-labelledby="services-heading">
      <div className="flex items-end justify-between border-y border-black/20 py-3 text-sm tracking-tight">
        <h2 id="services-heading">Services</h2>
        <span>Capabilities with project context</span>
      </div>
      <div className="divide-y divide-black/15">
        {services.map((service) => (
          <div key={service.number} className="grid gap-4 py-7 md:grid-cols-[5rem_1fr_1fr] md:items-baseline">
            <span className="text-sm text-[#5E5E5E]">{service.number}</span>
            <div>
              <h3 className="text-2xl tracking-tight md:text-4xl">{service.title}</h3>
              <p className="mt-2 text-sm text-[#5E5E5E] md:text-base">{service.description}</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('work')}
              className="justify-self-start border-b border-[#434343] pb-1 text-left text-sm tracking-tight transition-transform duration-300 hover:translate-x-1 md:justify-self-end"
            >
              Preview: {service.preview} -&gt;
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
