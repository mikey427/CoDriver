/** Single source of truth for spoken symbol/operator phrases → code characters. */
export const SYMBOL_MAP: Readonly<Record<string, string>> = {
  'open paren': '(',
  'close paren': ')',
  'open brace': '{',
  'close brace': '}',
  'open bracket': '[',
  'close bracket': ']',
  dot: '.',
  comma: ',',
  semicolon: ';',
  colon: ':',
  equals: '=',
  'double equals': '==',
  'equals equals': '==',
  'triple equals': '===',
  'not equals': '!==',
  'greater than': '>',
  'less than': '<',
  'greater equal': '>=',
  'less equal': '<=',
  plus: '+',
  minus: '-',
  star: '*',
  slash: '/',
  'question mark': '?',
  'optional chain': '?.',
  'nullish coalescing': '??',
  and: '&&',
  or: '||',
  bang: '!',
  quote: "'",
  'double quote': '"',
  backtick: '`',
  'new line': '\n',
  tab: '\t',
  space: ' ',
  'fat arrow': '=>',
};

/** Aliases accepted for registry symbol-only commands. */
export function getKnownSymbolAliases(): Set<string> {
  return new Set(Object.keys(SYMBOL_MAP));
}

export function findSymbolPhrase(tokens: string[], start: number): { len: number; emit: string } | null {
  const maxLen = Math.min(3, tokens.length - start);
  for (let len = maxLen; len >= 1; len--) {
    const phrase = tokens.slice(start, start + len).join(' ');
    const emit = SYMBOL_MAP[phrase];
    if (emit != null) return { len, emit };
  }
  return null;
}
