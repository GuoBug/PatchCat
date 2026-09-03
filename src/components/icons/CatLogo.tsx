import React from 'react';

interface CatLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
  withBackground?: boolean;
  backgroundColor?: string;
}

export const CatLogo: React.FC<CatLogoProps> = ({
  size = 28,
  color = 'currentColor',
  withBackground = false,
  backgroundColor = '#ffffff',
  className = '',
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      fill="none"
      className={`inline-block shrink-0 flex-shrink-0 ${className}`}
      {...props}
    >
      {withBackground && (
        <rect width="1024" height="1024" fill={backgroundColor} rx="160" />
      )}

      {/* Official PatchCat Geometric Silhouette (EvenOdd Vector) */}
      <path
        fill={color}
        fillRule="evenodd"
        d="M 815.0 155.0 L 773.0 460.0 L 818.0 594.0 L 516.0 879.0 L 216.0 594.0 L 261.0 460.0 L 218.0 156.0 L 401.0 318.0 L 614.0 318.0 L 579.0 350.0 L 387.0 350.0 L 264.0 241.0 L 290.0 424.0 L 353.0 371.0 L 294.0 463.0 L 254.0 582.0 L 254.0 585.0 L 292.0 620.0 L 330.0 588.0 L 314.0 541.0 L 329.0 502.0 L 456.0 484.0 Z M 769.0 242.0 L 742.0 436.0 L 713.0 520.0 L 743.0 477.0 L 779.0 584.0 L 598.0 755.0 L 531.0 729.0 L 531.0 698.0 L 566.0 668.0 L 569.0 657.0 L 465.0 657.0 L 467.0 667.0 L 502.0 697.0 L 503.0 729.0 L 436.0 755.0 L 317.0 642.0 L 349.0 615.0 L 438.0 624.0 L 477.0 583.0 L 480.0 507.0 Z M 515.0 754.0 L 574.0 776.0 L 517.0 832.0 L 459.0 777.0 Z"
      />
    </svg>
  );
};

export default CatLogo;
