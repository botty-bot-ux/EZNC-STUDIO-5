import React from 'react';

/**
 * Stock lucide `line-dot-right-horizontal` glyph (path + end dot). Reproduced locally
 * because the pinned lucide-react (0.546) predates this icon, and a major bump would
 * risk renaming icons used elsewhere. Same rendering contract as lucide: inherits
 * `currentColor`, size via className (Tailwind w-/h-), strokeWidth 2, round caps.
 */
export const LineDotRightHorizontal: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 12 L15 12" />
    <circle cx="18" cy="12" r="3" />
  </svg>
);
