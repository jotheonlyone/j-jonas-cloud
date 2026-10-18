import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { UserAccount } from '../types';
import { useToast } from './Toast';

export interface HelpSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAccount | null;
}

export const HelpSupportModal: React.FC<HelpSupportModalProps> = ({
  isOpen,
  onClose,
  user,
}) => {
  const { addToast } = useToast();

  // Prefill initial name once from user without restoring it if the user clears it
  const [name, setName] = useState(() => user?.username || '');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('Allgemeine Frage');
  const [message, setMessage] = useState('');
  const [botcheck, setBotcheck] = useState('');

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText('cloud@j-jonas.com');
      setCopied(true);
      addToast('success', 'E-Mail kopiert', 'cloud@j-jonas.com wurde in die Zwischenablage kopiert.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      addToast('info', 'E-Mail', 'cloud@j-jonas.com');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !message.trim()) {
      addToast('error', 'Fehlende Angaben', 'Bitte geben Sie Ihre E-Mail-Adresse und eine Nachricht ein.');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          access_key: '344d356e-29c2-42e7-b0d7-a885376776a8',
          subject: `[J.Jonas Cloud Kontakt] ${category} - ${name.trim() || 'Anonym'}`,
          from_name: name.trim() || 'J.Jonas Cloud Nutzer',
          name: name.trim() || 'Anonym',
          email: email.trim(),
          category,
          message: message.trim(),
          botcheck,
          account_username: user?.username || 'Nicht angemeldet',
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        addToast('success', 'Nachricht gesendet', 'Vielen Dank! Ihre Nachricht wurde erfolgreich übermittelt.');
      } else {
        setStatus('error');
        setErrorMessage(data.message || 'Die Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es erneut.');
        addToast('error', 'Fehler', 'Nachricht konnte nicht gesendet werden.');
      }
    } catch (err: unknown) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : 'Verbindungsfehler beim Absenden.';
      setErrorMessage(msg);
      addToast('error', 'Verbindungsfehler', 'Bitte überprüfen Sie Ihre Verbindung oder schreiben Sie an cloud@j-jonas.com.');
    }
  };

  const handleResetForm = () => {
    setMessage('');
    setStatus('idle');
    setErrorMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Brauchen Sie Hilfe?
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
              Sie können uns jederzeit kontaktieren.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer shrink-0"
            aria-label="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1 -mr-1">
          {status === 'success' ? (
            /* Success Feedback Card */
            <div className="p-6 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Nachricht erfolgreich übermittelt!
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1 max-w-md mx-auto">
                  Vielen Dank für Ihre Anfrage. Wir werden Ihnen schnellstmöglich an{' '}
                  <strong className="text-gray-900 dark:text-gray-100">{email}</strong> antworten.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  Weitere Nachricht schreiben
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
                >
                  Fertig
                </button>
              </div>
            </div>
          ) : (
            /* Contact Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="checkbox"
                name="botcheck"
                value={botcheck}
                onChange={(e) => setBotcheck(e.target.value)}
                className="hidden"
                style={{ display: 'none' }}
                tabIndex={-1}
                autoComplete="off"
              />

              {status === 'error' && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold">Fehler beim Senden: </span>
                    {errorMessage}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Ihr Name <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name eingeben oder frei lassen"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Ihre E-Mail-Adresse <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@beispiel.de"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Thema / Kategorie
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
                >
                  <option value="Allgemeine Frage">Allgemeine Frage</option>
                  <option value="Technisches Problem / Fehler">Technisches Problem / Fehler</option>
                  <option value="Speicherplatz erweitern">Speicherplatz erweitern</option>
                  <option value="Konto & Zugangsdaten">Konto & Zugangsdaten</option>
                  <option value="Dateien & Freigaben">Dateien & Freigaben</option>
                  <option value="Feedback & Verbesserungsvorschlag">Feedback & Verbesserungsvorschlag</option>
                  <option value="Sonstiges">Sonstiges</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Ihre Nachricht <span className="text-red-500 font-bold">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Wie können wir Ihnen weiterhelfen? Bitte beschreiben Sie Ihr Anliegen..."
                  className="w-full p-3.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-y min-h-[96px]"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  <span className="text-red-500">*</span> Pflichtfeld für Antwort
                </span>

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all disabled:opacity-50 cursor-pointer shadow-xs active:scale-98"
                >
                  {status === 'loading' ? 'Wird gesendet...' : 'Nachricht absenden'}
                </button>
              </div>
            </form>
          )}

          {/* Direkt per E-Mail schreiben (nur die anklickbare E-Mail-Adresse) */}
          <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-800 text-center">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Möchten Sie lieber direkt per E-Mail schreiben?
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 mb-2.5">
              Klicken Sie auf die Adresse, um sie zu kopieren:
            </p>

            <button
              type="button"
              onClick={handleCopyEmail}
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200/80 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-900 dark:text-gray-100 font-mono text-xs font-semibold transition-all cursor-pointer active:scale-98 border border-gray-200 dark:border-gray-700 shadow-xs"
              title="Klicken zum Kopieren"
            >
              <span>{copied ? '✓ In Zwischenablage kopiert!' : 'cloud@j-jonas.com'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end text-[11px] text-gray-400 dark:text-gray-500 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="hover:text-gray-600 dark:hover:text-gray-300 underline cursor-pointer"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
