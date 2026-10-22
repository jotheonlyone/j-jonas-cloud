import React, { useState } from 'react';
import {
  User,
  Lock,
  ArrowRight,
  ArrowLeft,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
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
  const isModal = Boolean(onClose);
  // Unangemeldet auf der Hauptseite starten mit der Willkommens-Ansicht (zwei Knöpfe: Anmelden & Registrieren)
  const [currentView, setCurrentView] = useState<'welcome' | 'form'>(() =>
    isModal ? 'form' : 'welcome'
  );
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
        setUsernameError(
          'Benutzername darf nur Kleinbuchstaben (a-z), Zahlen, Bindestriche (-) und Unterstriche (_) enthalten.'
        );
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
        setErrorMsg(
          'Benutzername darf nur Kleinbuchstaben (a-z), Zahlen, Bindestriche (-) und Unterstriche (_) enthalten.'
        );
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
            setInfoMsg(
              'Registrierung erfolgreich! Dein Account wartet noch auf Freischaltung durch den Administrator.'
            );
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
      const msg =
        err instanceof Error ? err.message : 'Ein unerwarteter Fehler ist aufgetreten.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Großzügige Willkommensansicht mit großem Wolken-Logo und zwei Knöpfen: "Anmelden" & "Registrieren"
  const welcomeContent = (
    <div className="w-full max-w-xl flex flex-col items-center text-center py-6 px-4 sm:px-6 animate-in fade-in zoom-in-95 duration-200">
      {/* Wolken-Logo viel größer */}
      <div
        className="inline-block select-none cursor-pointer group mb-4"
        style={{
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <CloudLogo
          className="w-36 h-28 sm:w-48 sm:h-38 md:w-56 md:h-44 text-blue-600 dark:text-blue-500 shrink-0 transition-transform duration-300 group-hover:scale-105"
          style={{
            filter: 'drop-shadow(0 12px 30px rgba(37, 99, 235, 0.35))',
          }}
        />
      </div>

      {/* Textplatz: Titel und Untertitel viel größer */}
      <h1
        className="font-black tracking-tight text-4xl sm:text-5xl md:text-6xl text-blue-600 hover:text-blue-700 dark:text-blue-500 transition-colors mb-2.5 whitespace-nowrap"
        style={{
          filter: 'drop-shadow(0 4px 16px rgba(37, 99, 235, 0.25))',
        }}
      >
        J.Jonas Cloud
      </h1>
      <p className="text-lg sm:text-2xl text-gray-700 dark:text-gray-200 font-semibold mb-2">
        Private Cloud-Speicherplattform
      </p>
      <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 max-w-md mb-8">
        Sicherer und schneller Zugriff auf persönliche Dateien, Medien und freigegebene Ordner.
      </p>

      {/* Zwei prominente Buttons */}
      <div className="w-full max-w-sm flex flex-col sm:flex-row items-center gap-3.5 mb-8">
        <button
          type="button"
          onClick={() => {
            setIsRegistering(false);
            setCurrentView('form');
            setErrorMsg('');
            setInfoMsg('');
          }}
          className="w-full py-3.5 px-6 rounded-2xl font-bold text-base bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
          <User className="w-5 h-5 shrink-0" />
          <span>Anmelden</span>
          <ArrowRight className="w-4 h-4 shrink-0 ml-0.5" />
        </button>

        <button
          type="button"
          onClick={() => {
            setIsRegistering(true);
            setCurrentView('form');
            setErrorMsg('');
            setInfoMsg('');
          }}
          className="w-full py-3.5 px-6 rounded-2xl font-bold text-base bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-2 border-blue-600/30 dark:border-blue-500/40 hover:bg-blue-50/60 dark:hover:bg-gray-700/60 shadow-sm flex items-center justify-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
          <UserPlus className="w-5 h-5 shrink-0" />
          <span>Registrieren</span>
          <ArrowRight className="w-4 h-4 shrink-0 ml-0.5" />
        </button>
      </div>

      {/* Rechtliche Pflichtlinks */}
      <div className="mt-4 text-center">
        <LegalLinks />
      </div>
    </div>
  );

  // 2. Anmelde- bzw. Registrierungs-Formular
  const formContent = (
    <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
      {/* Zurück-Option zur Auswahl (nur wenn nicht als Modal geöffnet) */}
      {!isModal && (
        <div className="flex items-center justify-between mb-3 px-1">
          <button
            type="button"
            onClick={() => {
              setCurrentView('welcome');
              setErrorMsg('');
              setInfoMsg('');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Zurück zur Auswahl</span>
          </button>
        </div>
      )}

      {/* Logo und Brand im Formular-Kopf (nur in Vollbildansicht) */}
      {!isModal && (
        <div className="text-center mb-6">
          <div
            onClick={() => setCurrentView('welcome')}
            className="inline-block select-none cursor-pointer group"
            style={{
              fontFamily:
                'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}
          >
            <h1
              className="flex items-center justify-center gap-2.5 font-black tracking-tight text-3xl sm:text-4xl text-blue-600 group-hover:text-blue-700 dark:text-blue-500 dark:group-hover:text-blue-400 transition-colors whitespace-nowrap"
              style={{
                filter: 'drop-shadow(0 4px 12px rgba(37, 99, 235, 0.25))',
              }}
            >
              <CloudLogo className="w-16 h-13 -my-3 -mx-3 sm:w-20 sm:h-16 sm:-my-4 sm:-mx-4 shrink-0 transition-transform group-hover:scale-105" />
              <span>J.Jonas Cloud</span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Private Cloud-Speicherplattform
          </p>
        </div>
      )}

      {/* Auth Card */}
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
            className="w-full mt-2 py-2.5 px-4 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-60 cursor-pointer"
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

        {/* Umschalter zwischen Login und Registrierung (bleibt bestehen, falls verklickt) */}
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
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
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
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
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
          {formContent}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full flex flex-col justify-center items-center p-4 bg-[#f8fafd] dark:bg-gray-950 select-none">
      {currentView === 'welcome' ? welcomeContent : formContent}
    </div>
  );
};
