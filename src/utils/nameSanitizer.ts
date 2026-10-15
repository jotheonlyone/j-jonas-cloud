/**
 * Strict whitelist & filename sanitization utility for cloud.j-jonas.com
 *
 * Whitelist allowed characters:
 * - Standard letters: a-z, A-Z
 * - German Umlauts: ä, ö, ü, Ä, Ö, Ü, ß
 * - Digits: 0-9
 * - Allowed Symbols: space (' '), hyphen ('-'), underscore ('_'), dot ('.')
 *
 * Constraint:
 * - A dot ('.') must NEVER be at the very start of a name (no leading dots).
 * All other special characters or control characters are strictly forbidden.
 */

// Whitelist character regex for testing complete string
export const WHITELIST_REGEX = /^[a-zA-Z0-9äöüÄÖÜß _.-]+$/;

// Single character test against whitelist
export function isAllowedChar(char: string): boolean {
  return /^[a-zA-Z0-9äöüÄÖÜß _.-]$/.test(char);
}

// Validation function for submission
export function validateItemName(name: string): { valid: boolean; error?: string } {
  if (!name || !name.trim()) {
    return { valid: false, error: 'Der Name darf nicht leer sein.' };
  }
  if (name.startsWith('.')) {
    return { valid: false, error: 'Ein Punkt darf nicht am Anfang des Namens stehen.' };
  }
  if (!WHITELIST_REGEX.test(name)) {
    return {
      valid: false,
      error: 'Erlaubt sind nur Buchstaben, Umlaute (ä, ö, ü, ß), Zahlen, Leerzeichen, -, _ und . (kein führender Punkt).',
    };
  }
  return { valid: true };
}

// Clean any string by removing forbidden characters and leading dots
export function sanitizeNameString(input: string): string {
  // 1. Remove all characters not in whitelist
  let cleaned = input.replace(/[^a-zA-Z0-9äöüÄÖÜß _.-]/g, '');
  // 2. Remove leading dots
  cleaned = cleaned.replace(/^\.+/, '');
  return cleaned;
}

// Upload filename sanitizer (removes characters outside whitelist and leading dots)
export function sanitizeUploadFileName(fileName: string): string {
  // 1. Remove all characters not in whitelist
  let cleaned = fileName.replace(/[^a-zA-Z0-9äöüÄÖÜß _.-]/g, '');
  // 2. Remove leading dots
  cleaned = cleaned.replace(/^\.+/, '');
  // 3. Fallback if empty or whitespace only
  if (!cleaned.trim()) {
    cleaned = `datei_${Date.now()}`;
  }
  return cleaned;
}

export interface InputFilterResult {
  value: string;
  hasError: boolean;
  error?: string;
}

/**
 * Live input sanitizer for folder creation and rename inputs.
 * Blocks any character outside the whitelist and blocks leading dots directly on input.
 * Returns the cleaned value along with an error message to display if invalid input was attempted.
 */
export function filterNameInput(rawInput: string): InputFilterResult {
  let value = '';
  let blockedLeadingDot = false;
  let blockedForbiddenChar = false;

  for (let i = 0; i < rawInput.length; i++) {
    const ch = rawInput[i];
    // Leading dot is strictly forbidden
    if (value.length === 0 && ch === '.') {
      blockedLeadingDot = true;
      continue;
    }
    // Whitelist check
    if (isAllowedChar(ch)) {
      value += ch;
    } else {
      blockedForbiddenChar = true;
    }
  }

  let error: string | undefined;
  if (blockedLeadingDot) {
    error = 'Ein Punkt darf nicht am Anfang des Namens stehen.';
  } else if (blockedForbiddenChar) {
    error = 'Ungültiges Sonderzeichen blockiert. Erlaubt sind nur Buchstaben, Umlaute (ä, ö, ü, ß), Zahlen, Leerzeichen, -, _ und .';
  }

  return {
    value,
    hasError: blockedLeadingDot || blockedForbiddenChar,
    error,
  };
}
