import React, { useState, useEffect } from 'react';
import { Copy, Check, FileCode, Loader2, AlertCircle } from 'lucide-react';
import { storageFetch } from '../services/storageApi';

export function isTextFile(fileName: string, mimeType?: string): boolean {
  if (mimeType) {
    const lowMime = mimeType.toLowerCase();
    if (
      lowMime.startsWith('text/') ||
      lowMime.includes('json') ||
      lowMime.includes('javascript') ||
      lowMime.includes('typescript') ||
      lowMime.includes('xml') ||
      lowMime.includes('yaml') ||
      lowMime.includes('csv')
    ) {
      return true;
    }
  }

  const cleanName = fileName.split('?')[0].split('#')[0];
  const baseName = cleanName.split('/').pop()?.toLowerCase() || '';
  const ext = baseName.includes('.') ? baseName.split('.').pop() || '' : '';

  // Exact file names without standard extensions
  const exactNames = [
    'dockerfile',
    'makefile',
    'license',
    'licence',
    'readme',
    '.gitignore',
    '.gitattributes',
    '.editorconfig',
    '.env',
    '.env.example',
    '.env.local',
    '.env.production',
    '.env.development',
    '.npmrc',
    '.babelrc',
    '.prettierrc',
    '.eslintrc',
  ];
  if (exactNames.includes(baseName)) {
    return true;
  }

  const textExtensions = [
    'txt', 'md', 'markdown', 'json', 'json5',
    'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx',
    'html', 'htm', 'xml', 'svg',
    'css', 'scss', 'sass', 'less',
    'py', 'pyw', 'sh', 'bash', 'zsh', 'fish',
    'log', 'csv', 'tsv',
    'yaml', 'yml', 'toml',
    'env', 'ini', 'sql', 'conf', 'config', 'cfg',
    'rtf', 'c', 'cpp', 'cc', 'cxx', 'h', 'hpp',
    'java', 'kt', 'kts', 'scala', 'groovy',
    'go', 'rs', 'swift', 'php', 'rb', 'pl', 'pm',
    'lua', 'r', 'dart', 'vue', 'svelte'
  ];

  return textExtensions.includes(ext);
}

interface TextViewerProps {
  fileName: string;
  url: string;
  isPublic?: boolean;
  className?: string;
  maxHeightClass?: string;
}

export const TextViewer: React.FC<TextViewerProps> = ({
  fileName,
  url,
  isPublic = false,
  className = '',
  maxHeightClass = 'max-h-[75vh]',
}) => {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!url) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // If public (e.g. /share/:shareId for unauthenticated guests), use standard fetch without auth headers
    const requestPromise = isPublic
      ? fetch(url).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
      : storageFetch(url).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        });

    requestPromise
      .then((text) => {
        if (isMounted) {
          setContent(text);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('TextViewer fetch error:', err);
          setError('Dateiinhalt konnte nicht geladen werden.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [url, isPublic]);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lineCount = content !== null ? content.split('\n').length : 0;

  return (
    <div
      className={`w-full h-full flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 ${maxHeightClass} ${className}`}
    >
      {/* Subheader / Control bar with filename, line count, and copy button */}
      <div className="px-4 py-2.5 bg-gray-50/90 dark:bg-gray-800/90 border-b border-gray-200/80 dark:border-gray-700/80 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 shrink-0">
        <div className="flex items-center gap-2 font-mono truncate mr-3">
          <FileCode className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="truncate font-semibold text-gray-800 dark:text-gray-200" title={fileName}>
            {fileName}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {content !== null && (
            <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
              {lineCount} {lineCount === 1 ? 'Zeile' : 'Zeilen'}
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            disabled={!content || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-gray-200/80 dark:bg-gray-700/80 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs"
            title="Inhalt in Zwischenablage kopieren"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Kopiert' : 'Kopieren'}</span>
          </button>
        </div>
      </div>

      {/* Code / Text Display */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 font-mono text-xs leading-relaxed select-text bg-[#fbfcfd] dark:bg-[#0f1115]">
        {isLoading ? (
          <div className="h-48 flex flex-col items-center justify-center text-gray-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-xs">Inhalt wird geladen...</span>
          </div>
        ) : error ? (
          <div className="h-48 flex flex-col items-center justify-center text-red-500 gap-2">
            <AlertCircle className="w-6 h-6" />
            <span className="text-xs">{error}</span>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200 font-mono">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
};
