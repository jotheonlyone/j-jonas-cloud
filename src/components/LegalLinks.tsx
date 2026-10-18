import React from 'react';

interface LegalLinksProps {
  className?: string;
}

export const LegalLinks: React.FC<LegalLinksProps> = ({ className = '' }) => {
  return (
    <div
      className={`inline-flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 select-none ${className}`}
    >
      <a
        href="/kontakt"
        onClick={(e) => {
          e.preventDefault();
          if (typeof window !== 'undefined') {
            window.history.pushState({ contact: true }, '', '/kontakt');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
        }}
        className="hover:underline transition-colors"
      >
        Kontakt & Hilfe
      </a>
      <span className="text-gray-400 dark:text-gray-600 font-bold">•</span>
      <a
        href="https://j-jonas.com/impressum"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline transition-colors"
      >
        Impressum
      </a>
      <span className="text-gray-400 dark:text-gray-600 font-bold">•</span>
      <a
        href="https://j-jonas.com/datenschutz"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline transition-colors"
      >
        Datenschutz
      </a>
    </div>
  );
};
