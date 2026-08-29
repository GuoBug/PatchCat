import React from 'react';

interface CatLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
  withBackground?: boolean;
  backgroundColor?: string;
}

export const CatLogo: React.FC<CatLogoProps> = ({
  size = 24,
  color = 'currentColor',
  withBackground = false,
  backgroundColor = '#ffffff',
  className = '',
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      fill="none"
      className={`inline-block ${className}`}
      {...props}
    >
      {withBackground && (
        <rect width="200" height="200" fill={backgroundColor} rx="16" />
      )}

      {/* Bold Structural Strokes */}
      <g stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        {/* Left Ear & Jaw Contour */}
        <path d="M42 30 L42 116 L100 172" />
        <path d="M42 30 L78 62 L120 62 L160 30" />
        
        {/* Right Ear & Jaw Contour */}
        <path d="M160 30 L146 102 L160 116 L100 172" />

        {/* Left Ear Inner Accent Notch */}
        <path d="M54 74 L68 84" strokeWidth="4.5" />

        {/* Eyepatch Diagonal Strap (xAI Slash) */}
        <path d="M120 62 L42 122" strokeWidth="5" />

        {/* Nose & Mouth Geometric Mark */}
        <path d="M90 128 L110 128" strokeWidth="5" />
        <path d="M100 128 L100 144" strokeWidth="5" />
        <path d="M84 152 L100 144 L116 152 L100 166 Z" strokeWidth="4.5" />
      </g>

      {/* Solid Geometric Eyepatch (Opposite Eye Area is Clean Negative Space) */}
      <polygon
        points="62,94 96,94 94,124 64,124"
        fill={color}
        stroke={color}
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
};
export default CatLogo;
