import React from 'react';

export interface CloudLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
  strokeWidth?: number | string;
}


/**
 * Organisches Wolken-Logo (Outline/Stroke) exakt nach Vorgabe:
 * - Neuer SVG-Pfad & Geometrie mit viewBox="-15.2 -12.5 64 52"
 * - Reiner Pfad ohne Verschiebung (kein transform-Wrapper)
 * - Breitere, flache Basislinie unten, asymmetrisch-organische Kontur
 * - Dynamische Farbvererbung (currentColor) & Glow-/Schatteneffekt
 * - Runde Ecken (stroke-linecap="round", stroke-linejoin="round") und fill="none"
 */
export const CloudLogo: React.FC<CloudLogoProps> = ({
  className = 'w-[4.5rem] h-[3.75rem] -my-4 -ml-4 -mr-4 md:w-24 md:h-20 md:-my-5 md:-ml-5 md:-mr-5',
  size,
  strokeWidth = 2.4,
  style,
  ...props
}) => {
  return (
    <svg
      viewBox="-15.2 -12.5 64 52"
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
      <path d="M 5.5 21.0 L 26.5 21.0 C 29.5 21.0 31.8 18.5 31.8 15.2 C 31.8 12.2 29.2 10.2 26.2 10.6 C 25.0 5.4 20.0 3.2 15.0 3.6 C 10.2 4.0 7.4 7.2 7.8 11.2 C 4.2 11.5 1.8 14.0 1.8 17.2 C 1.8 19.8 3.4 21.0 5.5 21.0 Z" />
    </svg>
  );
};

