import React, { useState } from 'react';
import { User, Lock, ArrowRight, AlertCircle, CheckCircle2, Eye, EyeOff, X } from 'lucide-react';
import { registerUser, loginUser } from '../services/firebase';
import type { UserAccount } from '../types';
import { LegalLinks } from './LegalLinks';
import { CloudLogo } from './CloudLogo';

interface AuthModalProps {
  onSuccess: (user: UserAccount) => void;
  darkMode?: boolean;
  onClose?: () => void;
  isAddAccountMode?: boolean;
  initialUsername?: string;
  isSwitchMode?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  onSuccess,
  darkMode = false,
  onClose,
  isAddAccountMode = false,
  initialUsername = '',
  isSwitchMode = false,
}) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState(initialUsername || '');
  const [usernameError, setUsernameError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUsernameChange = (val: string) => {
    if (isSwitchMode) return;
    setUsername(val);
    if (isRegistering) {
      if (/\s/.test(val)) {
        setUsernameError('Benutzername darf keine Leerzeichen enthalten.');
      } else if (val && !/^[a-z0-9_-]+$/.test(val.toLowerCase())) {
        setUsernameError('Benutzername darf nur Kleinbuchstaben (a-z), Zahlen, Bindestriche (-) und Unterstriche (_) enthalten.');
      } else {
        setUsernameError('');
      }
    } else {
      setUsernameError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (!username.trim() || !password) {
      setErrorMsg('Bitte Benutzername und Passwort angeben.');
      return;
    }

    if (isRegistering) {
      if (/\s/.test(username)) {
        setErrorMsg('Benutzername darf keine Leerzeichen enthalten.');
        setUsernameError('Benutzername darf keine Leerzeichen enthalten.');
        return;
      }
      const cleanU = username.trim().toLowerCase().replace(/\s+/g, '');
      if (!cleanU || !/^[a-z0-9_-]+$/.test(cleanU)) {
        setErrorMsg('Benutzername darf nur Kleinbuchstaben (a-z), Zahlen, Bindestriche (-) und Unterstriche (_) enthalten.');
        return;
      }
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

  const isModal = Boolean(onClose);

  const authContent = (
    <div className="w-full max-w-md">
      {/* Logo and Brand in Header (only in full-page mode) */}
      {!isModal && (
        <div className="text-center mb-7">
          <div
            className="inline-block select-none cursor-pointer"
            style={{
              fontFamily:
                'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}
          >
            <h1
              className="flex items-center justify-center gap-2.5 font-black tracking-tight text-3xl sm:text-4xl text-blue-600 hover:text-blue-700 dark:text-blue-500 dark:hover:text-blue-400 transition-colors"
              style={{
                filter: 'drop-shadow(0 4px 12px rgba(37, 99, 235, 0.25))',
              }}
            >
              <CloudLogo className="w-8 h-8 sm:w-9 sm:h-9 shrink-0" />
              <span>J.Jonas Cloud</span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1.5 font-medium">
            Private Cloud-Speicherplattform
          </p>
        </div>
      )}

      {/* Auth Card in Google Drive Look */}
      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-6 sm:p-8 relative">
        {isModal && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100 dark:border-gray-800 pr-8">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {isSwitchMode
                ? 'Konto wechseln'
                : isAddAccountMode
                ? (isRegistering ? 'Weiteres Konto registrieren' : 'Weiteres Konto hinzufügen')
                : (isRegistering ? 'Konto erstellen' : 'Anmelden')}
            </h2>
            {isSwitchMode && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Passwort eingeben, um zu <span className="font-semibold text-blue-600 dark:text-blue-400">@{initialUsername || username}</span> zu wechseln.
              </p>
            )}
            {!isSwitchMode && isAddAccountMode && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Dein bisheriges Konto bleibt im Hintergrund gespeichert.
              </p>
            )}
          </div>
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
            {isSwitchMode ? 'Account-Wechsel' : isRegistering ? 'Registrierung' : 'Login'}
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
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  readOnly={isSwitchMode}
                  placeholder="Benutzername"
                  className={`w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none transition-colors ${
                    isRegistering && usernameError
                      ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20'
                      : 'border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800'
                  } ${
                    isSwitchMode ? 'opacity-85 cursor-not-allowed select-none bg-gray-100/80 dark:bg-gray-800/60' : ''
                  }`}
                />
              </div>
              {isRegistering && usernameError && (
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-1.5 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{usernameError}</span>
                </p>
              )}
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
                  <span>{isSwitchMode ? 'Anmelden & Wechseln' : isRegistering ? 'Registrieren' : 'Anmelden'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle between Login and Register */}
          {!isSwitchMode && (
            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 text-center">
              {isRegistering ? (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Bereits ein Konto?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(false);
                      setUsernameError('');
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
                      setUsernameError('');
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
          )}
        </div>

        {/* Rechtliche Pflichtlinks */}
        <div className="mt-6 text-center">
          <LegalLinks />
        </div>
      </div>
    );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
        <div
          className="fixed inset-0 cursor-pointer"
          onClick={onClose}
        />
        <div className="relative z-10 w-full max-w-md my-auto">
          {authContent}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full flex flex-col justify-center items-center p-4 bg-[#f8fafd] dark:bg-gray-950 select-none">
      {authContent}
    </div>
  );
};
