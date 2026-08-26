import React from "react";
import { monogramComplete } from "../../../assets";

export default function BrandLogo({ onClick }) {
  return (
    <a
      data-header-brand-logo="true"
      data-no-click-sfx="true"
      aria-label="Mohammad Faizal"
      className="fixed left-6 md:left-12 top-0 pt-6 md:pt-8 w-14 md:w-20 z-997 mix-blend-exclusion flex flex-col cursor-pointer transition-transform duration-300 hover:scale-105"
      href="/"
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}
    >
      <img
        src={monogramComplete}
        alt="Mohammad Faizal"
        className="w-full h-auto drop-shadow-md"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />
    </a>
  );
}
