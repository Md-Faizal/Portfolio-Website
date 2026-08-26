import React from "react";

export default function ShowcaseSection() {
  return (
<section className="w-screen flex flex-col home-showcase relative z-10 mt-12 md:mt-24">
<div className="flex flex-col px-6 md:px-12">
<div className="w-full relative flex flex-col gap-2 z-10">
<div className="w-full flex flex-row justify-between text-[#434343] tracking-tight">
<span>
      Imagery
     </span>
<span className="tracking-[-0.08em]">
      2026
     </span>
</div>
<div className="block w-full h-px bg-black/20">
</div>
</div>
<div className="flex flex-col gap-2 md:gap-4 text-[#434343] tracking-tight opacity-0 motion-reduce:opacity-100 mt-8 md:mt-12">
<div className="flex-row items-center gap-2 hidden">
<span className="opacity-0 title-and-desc-title blur translate-x-4 text-sm motion-reduce:opacity-100 motion-reduce:translate-x-0 motion-reduce:blur-none hidden">
      (
      
      )
     </span>
</div>
<p className="text-2xl md:text-4xl font-300 title-and-desc-text opacity-0 tracking-tight leading-none motion-reduce:opacity-100">
     We help visionary brands flourish
     <br/>
     by crafting digital experiences that let
     <br/>
     audiences feel the depth, elegance, and
     <br/>
     essence of their products.
    </p>
</div>
</div>
<div className="flex flex-col showcase-wrapper items-center gap-[1.5vw] mt-32 md:mt-24 overflow-x-hidden scale-170 md:scale-100">
<div className="flex flex-row showcase-row row-1 items-end gap-[1.5vw]">
<img className="w-[32.2vw] md:w-[22.2vw]" />
<img className="w-[47.2vw] md:w-[37.2vw]" />
<img className="w-[35.6vw] md:w-[25.6vw]" />
<img className="w-[32.2vw] md:w-[22.2vw]" />
</div>
<div className="flex flex-row showcase-row row-2 items-start justify-end gap-[1.5vw]">
<img className="w-[32.2vw] md:w-[22.2vw]" />
<img className="w-[35.6vw] md:w-[25.6vw]" />
<img className="w-[47.2vw] md:w-[37.2vw]" />
<img className="w-[32.2vw] md:w-[22.2vw]" />
</div>
</div>
</section>
  );
}
