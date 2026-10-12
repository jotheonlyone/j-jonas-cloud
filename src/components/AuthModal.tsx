import React, { useState } from 'react';
import { User, Lock, ArrowRight, AlertCircle, CheckCircle2, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import { registerUser, loginUser } from '../services/firebase';
import type { UserAccount } from '../types';
import { LegalLinks } from './LegalLinks';

interface AuthModalProps {
  onSuccess: (user: UserAccount) => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  onSuccess,
  darkMode = false,
  onToggleDarkMode,
}) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (!username.trim() || !password) {
      setErrorMsg('Bitte Benutzername und Passwort angeben.');
      return;
    }

    if (isRegistering && password !== confirmPassword) {
      setErrorMsg('Die Passwörter stimmen nicht überein.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRegistering) {
        const res = await registerUser(username, password);
        if (res.success && res.user) {
          if (res.isFirstMaster) {
            setInfoMsg('Erster Account im System: Als Master-Administrator eingerichtet.');
            setTimeout(() => {
              onSuccess(res.user!);
            }, 1000);
          } else {
            setInfoMsg('Registrierung erfolgreich! Dein Account wartet noch auf Freischaltung durch den Administrator.');
            setIsRegistering(false);
            setPassword('');
            setConfirmPassword('');
          }
        } else {
          setErrorMsg(res.error || 'Registrierung fehlgeschlagen.');
        }
      } else {
        const res = await loginUser(username, password);
        if (res.success && res.user) {
          onSuccess(res.user);
        } else {
          setErrorMsg(res.error || 'Login fehlgeschlagen.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ein unerwarteter Fehler ist aufgetreten.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-full flex flex-col justify-center items-center p-4 bg-[#f8fafd] dark:bg-gray-950 select-none">
      {/* Top right theme toggle */}
      {onToggleDarkMode && (
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="p-2.5 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors shadow-xs"
            title={darkMode ? 'Heller Modus' : 'Dunkler Modus'}
            aria-label="Design umschalten"
          >
            {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-gray-600" />}
          </button>
        </div>
      )}

      <div className="w-full max-w-md">
        {/* Logo and Brand in Header */}
        <div className="text-center mb-7">
          <div
            className="inline-block select-none cursor-pointer"
            style={{
              fontFamily:
                'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}
          >
            <h1
              className="font-black tracking-tight text-3xl sm:text-4xl text-blue-600 hover:text-blue-700 dark:text-blue-500 dark:hover:text-blue-400 transition-colors"
              style={{
                filter: 'drop-shadow(0 4px 12px rgba(37, 99, 235, 0.25))',
              }}
            >
              J.Jonas Cloud
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1.5 font-medium">
            Private Cloud-Speicherplattform
          </p>
        </div>

        {/* Auth Card in Google Drive Look */}
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs p-6 sm:p-8">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {isRegistering ? 'Konto erstellen' : 'Anmelden'}
            </h2>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
              {isRegistering ? 'Registrierung' : 'Login'}
            </span>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-start gap-2.5 text-xs text-blue-700 dark:text-blue-300 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <div className="flex-1">{infoMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Benutzername
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Benutzername"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Passwort
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Passwort"
                  className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"
                  title={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isRegistering && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Passwort bestätigen
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Passwort bestätigen"
                    className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"
                    title={showConfirmPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 px-4 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-60"
            >
              {isSubmitting ? (
                <span>Wird verarbeitet...</span>
              ) : (
                <>
                  <span>{isRegistering ? 'Registrieren' : 'Anmelden'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle between Login and Register */}
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 text-center">
            {isRegistering ? (
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Bereits ein Konto?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(false);
                    setErrorMsg('');
                    setInfoMsg('');
                  }}
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Hier anmelden
                </button>
              </p>
            ) : (
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Noch kein Konto?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(true);
                    setErrorMsg('');
                    setInfoMsg('');
                  }}
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Jetzt registrieren
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Rechtliche Pflichtlinks */}
        <div className="mt-6 text-center">
          <LegalLinks />
        </div>
      </div>
    </div>
  );
};
