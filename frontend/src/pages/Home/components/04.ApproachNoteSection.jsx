import React from 'react';

export default function ApproachNoteSection() {
  return (
    <section id="section-approach-note" className="w-screen px-6 pb-28 text-[#434343] md:px-12 md:pb-44" aria-labelledby="approach-note-heading">
      <div className="border-y border-black/20 py-3 text-sm tracking-tight">
        <h2 id="approach-note-heading">Short note</h2>
      </div>
      <p className="mt-7 max-w-3xl text-xl leading-tight tracking-tight md:text-4xl">
        I prefer working close to the product: understanding the workflow, making the interface clear, and carrying the important details through to implementation.
      </p>
    </section>
  );
}