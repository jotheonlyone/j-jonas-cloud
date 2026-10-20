import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Sparkles,
  Tv
} from 'lucide-react';
import { registerUser, loginUser, cleanUsername } from '../services/firebase';
import type { UserAccount } from '../types';
import { LegalLinks } from './LegalLinks';

interface CinemaTvAuthModalProps {
  onSuccess: (user: UserAccount) => void;
  onStartDemo?: () => void;
}

type TvFocusTarget =
  | 'username'
  | 'password'
  | 'password_eye'
  | 'confirm_password'
  | 'confirm_password_eye'
  | 'submit'
  | 'toggle_mode'
  | 'demo';

export const CinemaTvAuthModal: React.FC<CinemaTvAuthModalProps> = ({
  onSuccess,
  onStartDemo,
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

  // TV D-Pad Focus State
  const [tvFocus, setTvFocus] = useState<TvFocusTarget>('username');

  // DOM Refs to focus real elements for typing
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const demoBtnRef = useRef<HTMLButtonElement>(null);
  const eyeBtnRef = useRef<HTMLButtonElement>(null);
  const confirmEyeBtnRef = useRef<HTMLButtonElement>(null);

  // Sync actual HTML focus when tvFocus changes
  useEffect(() => {
    switch (tvFocus) {
      case 'username':
        usernameRef.current?.focus();
        break;
      case 'password':
        passwordRef.current?.focus();
        break;
      case 'password_eye':
        eyeBtnRef.current?.focus();
        break;
      case 'confirm_password':
        confirmPasswordRef.current?.focus();
        break;
      case 'confirm_password_eye':
        confirmEyeBtnRef.current?.focus();
        break;
      case 'submit':
        submitBtnRef.current?.focus();
        break;
      case 'toggle_mode':
        toggleBtnRef.current?.focus();
        break;
      case 'demo':
        demoBtnRef.current?.focus();
        break;
    }
  }, [tvFocus, isRegistering]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg('');
    setInfoMsg('');

    if (!username.trim() || !password) {
      setErrorMsg('Bitte Benutzername und Passwort angeben.');
      return;
    }

    if (isRegistering) {
      if (/\s/.test(username)) {
        setErrorMsg('Benutzername darf keine Leerzeichen enthalten.');
        return;
      }
      const cleanU = cleanUsername(username);
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
            setTvFocus('username');
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

  // TV Remote D-Pad Navigation Handler
  useEffect(() => {
    const handleTvKeyDown = (e: KeyboardEvent) => {
      // Allow normal typing into inputs, but intercept navigation keys
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setTvFocus((current) => {
          if (isRegistering) {
            if (current === 'demo') return 'toggle_mode';
            if (current === 'toggle_mode') return 'submit';
            if (current === 'submit') return 'confirm_password';
            if (current === 'confirm_password' || current === 'confirm_password_eye') return 'password';
            if (current === 'password' || current === 'password_eye') return 'username';
            return 'username';
          } else {
            if (current === 'demo') return 'toggle_mode';
            if (current === 'toggle_mode') return 'submit';
            if (current === 'submit') return 'password';
            if (current === 'password' || current === 'password_eye') return 'username';
            return 'username';
          }
        });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setTvFocus((current) => {
          if (isRegistering) {
            if (current === 'username') return 'password';
            if (current === 'password' || current === 'password_eye') return 'confirm_password';
            if (current === 'confirm_password' || current === 'confirm_password_eye') return 'submit';
            if (current === 'submit') return 'toggle_mode';
            if (current === 'toggle_mode') return 'demo';
            return 'demo';
          } else {
            if (current === 'username') return 'password';
            if (current === 'password' || current === 'password_eye') return 'submit';
            if (current === 'submit') return 'toggle_mode';
            if (current === 'toggle_mode') return 'demo';
            return 'demo';
          }
        });
      } else if (e.key === 'ArrowRight') {
        if (tvFocus === 'password') {
          e.preventDefault();
          setTvFocus('password_eye');
        } else if (tvFocus === 'confirm_password') {
          e.preventDefault();
          setTvFocus('confirm_password_eye');
        }
      } else if (e.key === 'ArrowLeft') {
        if (tvFocus === 'password_eye') {
          e.preventDefault();
          setTvFocus('password');
        } else if (tvFocus === 'confirm_password_eye') {
          e.preventDefault();
          setTvFocus('confirm_password');
        }
      } else if (e.key === 'Enter') {
        if (tvFocus === 'username') {
          if (!password) {
            e.preventDefault();
            setTvFocus('password');
            return;
          } else {
            e.preventDefault();
            handleSubmit();
            return;
          }
        } else if (tvFocus === 'password') {
          e.preventDefault();
          if (isRegistering && !confirmPassword) {
            setTvFocus('confirm_password');
            return;
          }
          handleSubmit();
          return;
        } else if (tvFocus === 'confirm_password') {
          e.preventDefault();
          handleSubmit();
          return;
        } else if (tvFocus === 'submit') {
          e.preventDefault();
          handleSubmit();
          return;
        } else if (tvFocus === 'toggle_mode') {
          e.preventDefault();
          setIsRegistering((prev) => !prev);
          setErrorMsg('');
          setInfoMsg('');
          setTvFocus('username');
          return;
        } else if (tvFocus === 'demo') {
          e.preventDefault();
          if (onStartDemo) {
            onStartDemo();
          }
          return;
        } else if (tvFocus === 'password_eye') {
          e.preventDefault();
          setShowPassword((prev) => !prev);
          return;
        } else if (tvFocus === 'confirm_password_eye') {
          e.preventDefault();
          setShowConfirmPassword((prev) => !prev);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleTvKeyDown);
    return () => window.removeEventListener('keydown', handleTvKeyDown);
  }, [tvFocus, isRegistering, username, password, confirmPassword, onStartDemo, isSubmitting]);

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center items-center p-4 bg-[#141414] text-white select-none overflow-y-auto">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full blur-[140px] opacity-25"
          style={{ backgroundColor: '#E50914' }}
        />
        <div className="absolute inset-0 bg-radial-at-c from-transparent via-[#141414]/80 to-[#141414]" />
      </div>

      <div className="relative z-10 w-full max-w-md my-8">
        {/* Cinema Logo in Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex flex-col items-center select-none"
            style={{
              fontFamily:
                'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}
          >
            <h1
              className="font-black tracking-tight text-3xl sm:text-5xl leading-none select-none drop-shadow-md"
              style={{
                color: '#E50914',
                filter: 'drop-shadow(0 4px 18px rgba(229, 9, 20, 0.45))',
              }}
            >
              Video on Demand
            </h1>
            <span className="text-xs sm:text-sm font-medium text-gray-400 tracking-normal select-none mt-1.5 self-end">
              by J.Jonas Cloud
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-400 mt-3 font-medium">
            Private Cloud-Streaming für Smart-TVs
          </p>
        </div>

        {/* Auth Card in exact Cinema Theme */}
        <div className="rounded-2xl bg-[#1c1c1c] border border-white/10 shadow-2xl p-6 sm:p-8 relative">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
            <div>
              <h2 className="text-lg font-bold text-white">
                {isRegistering ? 'Konto erstellen' : 'Anmelden'}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {isRegistering
                  ? 'Erstelle ein Konto für Cinema TV'
                  : 'Melde dich an, um deine Videos zu streamen'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E50914]/20 border border-[#E50914]/30 text-[#E50914] text-[11px] font-bold">
              <Tv className="w-3.5 h-3.5" />
              <span>TV-Modus</span>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-800/80 flex items-start gap-2.5 text-xs text-red-200 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 p-3 rounded-xl bg-blue-950/60 border border-blue-800/80 flex items-start gap-2.5 text-xs text-blue-200 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
              <div className="flex-1">{infoMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Benutzername
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={usernameRef}
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setTvFocus('username')}
                  placeholder="Benutzername"
                  className={`w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border bg-white/10 text-white placeholder:text-gray-500 focus:outline-none transition-all ${
                    tvFocus === 'username'
                      ? 'border-[#E50914] ring-2 ring-[#E50914] ring-offset-2 ring-offset-[#1c1c1c] scale-[1.01]'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Passwort
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setTvFocus('password')}
                  placeholder="Passwort"
                  className={`w-full pl-10 pr-11 py-2.5 text-sm rounded-xl border bg-white/10 text-white placeholder:text-gray-500 focus:outline-none transition-all ${
                    tvFocus === 'password'
                      ? 'border-[#E50914] ring-2 ring-[#E50914] ring-offset-2 ring-offset-[#1c1c1c] scale-[1.01]'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                />
                <button
                  ref={eyeBtnRef}
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  onFocus={() => setTvFocus('password_eye')}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-white transition-all outline-none ${
                    tvFocus === 'password_eye'
                      ? 'bg-white/20 text-white ring-2 ring-[#E50914]'
                      : 'hover:bg-white/10'
                  }`}
                  title={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isRegistering && (
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Passwort bestätigen
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    ref={confirmPasswordRef}
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onFocus={() => setTvFocus('confirm_password')}
                    placeholder="Passwort bestätigen"
                    className={`w-full pl-10 pr-11 py-2.5 text-sm rounded-xl border bg-white/10 text-white placeholder:text-gray-500 focus:outline-none transition-all ${
                      tvFocus === 'confirm_password'
                        ? 'border-[#E50914] ring-2 ring-[#E50914] ring-offset-2 ring-offset-[#1c1c1c] scale-[1.01]'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  />
                  <button
                    ref={confirmEyeBtnRef}
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    onFocus={() => setTvFocus('confirm_password_eye')}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-white transition-all outline-none ${
                      tvFocus === 'confirm_password_eye'
                        ? 'bg-white/20 text-white ring-2 ring-[#E50914]'
                        : 'hover:bg-white/10'
                    }`}
                    title={showConfirmPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              ref={submitBtnRef}
              type="submit"
              disabled={isSubmitting}
              onFocus={() => setTvFocus('submit')}
              className={`w-full mt-3 py-3 px-4 rounded-xl font-bold text-sm bg-[#E50914] hover:bg-[#b80710] text-white shadow-lg shadow-[#E50914]/25 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-60 cursor-pointer outline-none ${
                tvFocus === 'submit'
                  ? 'ring-4 ring-white ring-offset-2 ring-offset-[#1c1c1c] scale-[1.02]'
                  : ''
              }`}
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
          <div className="mt-5 pt-4 border-t border-white/10 text-center">
            {isRegistering ? (
              <p className="text-xs text-gray-400">
                Bereits ein Konto?{' '}
                <button
                  ref={toggleBtnRef}
                  type="button"
                  onFocus={() => setTvFocus('toggle_mode')}
                  onClick={() => {
                    setIsRegistering(false);
                    setErrorMsg('');
                    setInfoMsg('');
                    setTvFocus('username');
                  }}
                  className={`font-semibold text-[#E50914] hover:underline cursor-pointer px-2 py-1 rounded-lg transition-all outline-none ${
                    tvFocus === 'toggle_mode'
                      ? 'bg-white/10 ring-2 ring-[#E50914]'
                      : ''
                  }`}
                >
                  Hier anmelden
                </button>
              </p>
            ) : (
              <p className="text-xs text-gray-400">
                Noch kein Konto?{' '}
                <button
                  ref={toggleBtnRef}
                  type="button"
                  onFocus={() => setTvFocus('toggle_mode')}
                  onClick={() => {
                    setIsRegistering(true);
                    setErrorMsg('');
                    setInfoMsg('');
                    setTvFocus('username');
                  }}
                  className={`font-semibold text-[#E50914] hover:underline cursor-pointer px-2 py-1 rounded-lg transition-all outline-none ${
                    tvFocus === 'toggle_mode'
                      ? 'bg-white/10 ring-2 ring-[#E50914]'
                      : ''
                  }`}
                >
                  Jetzt registrieren
                </button>
              </p>
            )}
          </div>

          {/* Direkter Demo-Modus Button (speziell für Smart-TV mit Fernbedienung) */}
          {onStartDemo && (
            <div className="mt-4 pt-4 border-t border-white/10 text-center">
              <button
                ref={demoBtnRef}
                type="button"
                onFocus={() => setTvFocus('demo')}
                onClick={onStartDemo}
                className={`w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer outline-none ${
                  tvFocus === 'demo'
                    ? 'bg-white text-black ring-4 ring-white ring-offset-2 ring-offset-[#1c1c1c] scale-[1.02] shadow-xl'
                    : 'bg-white/10 hover:bg-white/20 text-gray-200 border border-white/10'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Demo-Trailerschau ohne Login testen</span>
              </button>
            </div>
          )}
        </div>

        {/* TV Fernbedienung Tastaturhilfe */}
        <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-gray-400 select-none">
          <span>▲▼ Pfeiltasten: Navigieren</span>
          <span>·</span>
          <span>◄► Augen-Symbol</span>
          <span>·</span>
          <span>Enter / OK: Bestätigen</span>
        </div>

        {/* Rechtliche Pflichtlinks */}
        <div className="mt-6 text-center text-gray-400">
          <LegalLinks />
        </div>
      </div>
    </div>
  );
};
