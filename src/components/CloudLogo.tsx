import React from 'react';

export interface CloudLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
  strokeWidth?: number | string;
}


/**
 * Minimalistisches, organisches Wolken-Logo (Outline/Stroke) exakt nach Vorlage:
 * - Breitere, flache Basislinie unten
 * - Flacher und weiter außen ansetzende linke Ausbuchtung
 * - Sanft nach links versetzte, weich geschwungene Hauptkuppe oben (asymmetrisch)
 * - Kompaktere, harmonisch zur Bodenlinie abgerundete rechte Ausbuchtung
 * - Dynamisches currentColor mit ererbtem Glow-/Schatteneffekt
 */
export const CloudLogo: React.FC<CloudLogoProps> = ({
  className = 'w-8 h-8 md:w-9 md:h-9',
  size,
  strokeWidth = 2.4,
  style,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 32 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={`inline-block shrink-0 ${className}`}
      style={style}
      aria-hidden="true"
      {...props}
    >
      <path d="M 7.8 20.8 L 25.0 20.8 C 27.6 20.8 29.2 18.2 29.2 15.2 C 29.2 12.0 26.6 9.8 23.5 10.1 C 23.0 5.6 19.8 3.0 15.4 3.0 C 11.0 3.0 8.5 5.4 8.8 9.2 C 5.0 9.2 2.8 11.6 2.8 14.6 C 2.8 18.0 5.0 20.8 7.8 20.8 Z" />
    </svg>
  );
};

