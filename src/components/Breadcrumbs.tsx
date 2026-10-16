import React from 'react';
import { ChevronRight, Home, Folder } from 'lucide-react';

interface BreadcrumbsProps {
  currentPath: string; // e.g. "Dokumente/Schule" or ""
  rootLabel?: string;
  onNavigate: (path: string) => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  currentPath,
  rootLabel = 'Meine Ablage',
  onNavigate,
}) => {
  const segments = currentPath
    ? currentPath.split('/').filter(Boolean)
    : [];

  return (
    <nav className="flex items-center gap-1.5 text-sm py-2 overflow-x-auto select-none scrollbar-none">
      {/* Root */}
      <button
        onClick={() => {
          if (segments.length === 0) return;
          onNavigate('');
        }}
        disabled={segments.length === 0}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors font-semibold ${
          segments.length === 0
            ? 'text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 cursor-default'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer'
        }`}
      >
        <Home className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <span>{rootLabel}</span>
      </button>

      {/* Path Segments */}
      {segments.map((segment, index) => {
        const subPath = segments.slice(0, index + 1).join('/');
        const isLast = index === segments.length - 1;

        return (
          <React.Fragment key={subPath}>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            <button
              onClick={() => {
                if (isLast) return;
                onNavigate(subPath);
              }}
              disabled={isLast}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors max-w-[180px] truncate ${
                isLast
                  ? 'text-slate-900 dark:text-slate-100 font-semibold bg-slate-100 dark:bg-slate-800 cursor-default'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer'
              }`}
              title={segment}
            >
              <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="truncate">{segment}</span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
};
