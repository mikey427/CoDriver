import { applyCasing, identifierFromWords, parseCasingPrefix } from './casing.js';
import { KEYWORD_MAP, LITERAL_MAP } from './keyword-map.js';
import { findSymbolPhrase, SYMBOL_MAP } from './symbol-map.js';
import type { CodeEmissionResult } from './grammar-types.js';

function ok(text: string, confidence = 0.9, explanation?: string, warnings?: string[]): CodeEmissionResult {
  return { success: true, text, confidence, explanation, warnings };
}

function fail(explanation: string): CodeEmissionResult {
  return { success: false, text: '', confidence: 0, explanation };
}

function tokenize(text: string): string[] {
  return text.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function normalizeOutput(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .replace(/\[\s+/g, '[')
    .replace(/\s+\]/g, ']')
    .trim();
}

function emitValueTokens(tokens: string[]): string {
  if (tokens.length >= 2) {
    const two = `${tokens[0]} ${tokens[1]}`;
    if (LITERAL_MAP[two]) return LITERAL_MAP[two];
  }
  if (tokens.length >= 3) {
    const three = `${tokens[0]} ${tokens[1]} ${tokens[2]}`;
    if (LITERAL_MAP[three]) return LITERAL_MAP[three];
  }
  return emitTokensInternal(tokens).text;
}

function readCallArgs(tokens: string[], start: number): { args: string; end: number } | null {
  if (tokens[start] !== 'open' || tokens[start + 1] !== 'paren') return null;
  let depth = 1;
  let i = start + 2;
  const inner: string[] = [];
  while (i < tokens.length && depth > 0) {
    if (tokens[i] === 'open' && tokens[i + 1] === 'paren') {
      inner.push('open', 'paren');
      i += 2;
      depth++;
      continue;
    }
    if (tokens[i] === 'close' && tokens[i + 1] === 'paren') {
      depth--;
      if (depth === 0) {
        i += 2;
        break;
      }
      inner.push('close', 'paren');
      i += 2;
      continue;
    }
    inner.push(tokens[i]);
    i++;
  }
  return { args: emitValueTokens(inner), end: i };
}

function emitIdentifierTokens(tokens: string[], start: number): { id: string; end: number } {
  const words: string[] = [];
  let i = start;
  while (i < tokens.length) {
    const sym = findSymbolPhrase(tokens, i);
    if (sym || KEYWORD_MAP[tokens[i]] || tokens[i] === 'equals') break;
    if (tokens[i] === 'open' && tokens[i + 1] === 'paren') break;
    words.push(tokens[i]);
    i++;
  }
  const id = words.length > 1 ? identifierFromWords(words, 'variable') : words[0] ?? '';
  return { id, end: i };
}

function emitTokensInternal(tokens: string[]): CodeEmissionResult {
  const parts: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    const sym = findSymbolPhrase(tokens, i);
    if (sym) {
      parts.push(sym.emit);
      i += sym.len;
      continue;
    }

    const literal = LITERAL_MAP[tokens[i]];
    if (literal != null) {
      parts.push(literal);
      i++;
      continue;
    }

    if (tokens[i] === 'equals') {
      parts.push(' = ');
      i++;
      continue;
    }

    if (tokens[i] === 'slash') {
      parts.push('/');
      i++;
      continue;
    }

    if (tokens[i] === 'open' && tokens[i + 1] === 'paren') {
      const call = readCallArgs(tokens, i);
      if (call) {
        parts.push('(', call.args, ')');
        i = call.end;
        continue;
      }
    }

    const kw = KEYWORD_MAP[tokens[i]];
    if (kw === '!' || tokens[i] === 'not') {
      parts.push('!');
      i++;
      const id = emitIdentifierTokens(tokens, i);
      if (id.id) parts.push(id.id);
      i = id.end;
      continue;
    }

    if (kw && !['from', 'of', 'in'].includes(tokens[i])) {
      parts.push(kw);
      i++;
      if (['const', 'let', 'var', 'function', 'type', 'interface', 'class', 'export'].includes(tokens[i - 1])) {
        const id = emitIdentifierTokens(tokens, i);
        if (id.id) parts.push(' ', id.id);
        i = id.end;
      } else if (tokens[i - 1] === 'return' || tokens[i - 1] === 'await') {
        const rest = emitValueTokens(tokens.slice(i));
        if (rest) parts.push(' ', rest);
        break;
      }
      continue;
    }

    const id = emitIdentifierTokens(tokens, i);
    if (id.id) {
      parts.push(id.id);
      i = id.end;
      if (tokens[i] === 'dot') {
        parts.push('.');
        i++;
        const next = emitIdentifierTokens(tokens, i);
        if (next.id) {
          parts.push(next.id);
          i = next.end;
        }
      }
      if (tokens[i] === 'open' && tokens[i + 1] === 'paren') {
        const call = readCallArgs(tokens, i);
        if (call) {
          parts.push('(', call.args, ')');
          i = call.end;
        }
      }
      continue;
    }

    i++;
  }

  const text = normalizeOutput(parts.join(''));
  return text ? ok(text, 0.85) : fail('No emit-able tokens');
}

function tryPhrasePatterns(text: string): CodeEmissionResult | null {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');

  const casing = parseCasingPrefix(normalized);
  if (casing) {
    const words = casing.remainder.split(/\s+/);
    return ok(applyCasing(words, casing.style), 0.95, 'casing');
  }

  const decl = normalized.match(/^(const|let)\s+(.+?)\s+equals\s+(.+)$/);
  if (decl) {
    const name = identifierFromWords(decl[2].split(/\s+/), 'variable');
    const value = emitValueTokens(tokenize(decl[3]));
    return ok(`${decl[1]} ${name} = ${value}`, 0.92, 'declaration');
  }

  if (normalized === 'arrow function') return ok('() => ', 0.95, 'arrow');
  if (normalized === 'async arrow function') return ok('async () => ', 0.95, 'async arrow');

  const fn = normalized.match(/^async function\s+(.+)$/);
  if (fn) {
    const sig = emitFunctionSignature(fn[1]);
    return ok(`async function ${sig}`, 0.92, 'async function');
  }

  const fnSync = normalized.match(/^function\s+(.+)$/);
  if (fnSync) {
    const sig = emitFunctionSignature(fnSync[1]);
    return ok(`function ${sig}`, 0.92, 'function');
  }

  const ret = normalized.match(/^return\s+(.+)$/);
  if (ret) {
    return ok(`return ${emitValueTokens(tokenize(ret[1]))}`, 0.9, 'return');
  }

  const impDefault = normalized.match(/^import\s+(.+?)\s+from\s+(.+)$/);
  if (impDefault) {
    const namePart = impDefault[1].trim();
    const nameWords = namePart.split(/\s+/);
    const modulePath = pathFromSpeech(impDefault[2].trim());
    if (nameWords[0] === 'use' && nameWords.length >= 2) {
      const hook = identifierFromWords(nameWords, 'variable');
      return ok(`import { ${hook} } from '${modulePath}'`, 0.88, 'import named');
    }
    const name = identifierFromWords(nameWords, 'react');
    return ok(`import ${name} from '${modulePath}'`, 0.88, 'import default');
  }

  if (normalized.startsWith('export default ')) {
    const rest = normalized.slice('export default '.length);
    const name = identifierFromWords(rest.split(/\s+/), 'react');
    return ok(`export default ${name}`, 0.9, 'export default');
  }

  if (normalized.startsWith('export function ')) {
    const rest = normalized.slice('export function '.length);
    const sig = emitFunctionSignature(rest);
    const fnSig = sig.includes('(') ? sig : `${sig}()`;
    return ok(`export function ${fnSig}`, 0.9, 'export function');
  }

  if (normalized.startsWith('export type ')) {
    const rest = normalized.slice('export type '.length);
    const name = identifierFromWords(rest.split(/\s+/), 'type');
    return ok(`export type ${name}`, 0.9, 'export type');
  }

  if (normalized === 'if user') return ok('if (user) {', 0.9, 'if');
  if (normalized === 'if not user') return ok('if (!user) {', 0.9, 'if not');
  if (normalized === 'else') return ok('} else {', 0.9, 'else');
  if (normalized.startsWith('else if ')) {
    const cond = emitValueTokens(tokenize(normalized.slice('else if '.length)));
    return ok(`} else if (${cond}) {`, 0.88, 'else if');
  }
  if (normalized === 'try catch') return ok('try {\n} catch (error) {', 0.88, 'try catch');

  const forEach = normalized.match(/^for each\s+(\w+)\s+in\s+(\w+)$/);
  if (forEach) {
    const item = identifierFromWords([forEach[1]], 'variable');
    const collection = identifierFromWords([forEach[2]], 'variable');
    return ok(`${collection}.forEach((${item}) => {`, 0.88, 'for each');
  }

  const typePhrase = normalized.match(/^type\s+(.+)$/);
  if (typePhrase) {
    return ok(`type ${emitValueTokens(tokenize(typePhrase[1]))}`, 0.88, 'type');
  }

  return null;
}

function emitFunctionSignature(speech: string): string {
  const tokens = tokenize(speech);
  const openIdx = tokens.indexOf('open');
  if (openIdx < 0 || tokens[openIdx + 1] !== 'paren') {
    return identifierFromWords(tokens, 'variable');
  }
  const nameTokens = tokens.slice(0, openIdx);
  const name = identifierFromWords(nameTokens, 'variable');
  const call = readCallArgs(tokens, openIdx);
  const args = call?.args ?? '';
  return `${name}(${args})`;
}

function pathFromSpeech(speech: string): string {
  const parts = speech.split(/\s+slash\s+/);
  return parts
    .map((part) => {
      const words = part.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) return '';
      if (words.length === 1) return words[0];
      return identifierFromWords(words, 'variable');
    })
    .join('/');
}

/** Emit deterministic code from normalized utterance text. */
export function emitCodeFromText(text: string): CodeEmissionResult {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return fail('Empty utterance');

  const pattern = tryPhrasePatterns(normalized);
  if (pattern?.success) return pattern;

  const tokens = tokenize(normalized);
  if (tokens.length === 1 && SYMBOL_MAP[tokens[0]]) {
    return ok(SYMBOL_MAP[tokens[0]], 0.95, 'symbol');
  }

  return emitTokensInternal(tokens);
}

/** Emit from pre-tokenized utterance (from normalizer). */
export function emitCodeFromTokens(tokens: string[]): CodeEmissionResult {
  if (tokens.length === 0) return fail('Empty tokens');
  return emitCodeFromText(tokens.join(' '));
}

/** Apply grammar to registry dictation slot text (type/insert/say). */
export function emitDictationSlot(rawSlot: string): CodeEmissionResult {
  return emitCodeFromText(rawSlot);
}
