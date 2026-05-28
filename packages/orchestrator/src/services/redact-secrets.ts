const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[a-zA-Z0-9]{10,}\b/g,
  /\bBearer\s+[a-zA-Z0-9._-]{10,}\b/gi,
  /\b(api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[^\s'"]{8,}/gi,
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
];

/** Redact likely secrets from stream-facing text. */
export function redactSecrets(text: string, enabled = true): string {
  if (!enabled || !text) return text;
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}
