export type CasingStyle = 'camel' | 'pascal' | 'snake' | 'kebab' | 'constant';

export function applyCasing(words: string[], style: CasingStyle): string {
  const cleaned = words.filter(Boolean).map((w) => w.toLowerCase());
  if (cleaned.length === 0) return '';

  switch (style) {
    case 'camel':
      return (
        cleaned[0] +
        cleaned
          .slice(1)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join('')
      );
    case 'pascal':
      return cleaned.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
    case 'snake':
      return cleaned.join('_');
    case 'kebab':
      return cleaned.join('-');
    case 'constant':
      return cleaned.join('_').toUpperCase();
    default:
      return cleaned.join('');
  }
}

export function parseCasingPrefix(text: string): { style: CasingStyle; remainder: string } | null {
  const match = text.match(/^(camel case|pascal case|snake case|kebab case|constant case)\s+(.+)$/i);
  if (!match) return null;
  const styleMap: Record<string, CasingStyle> = {
    'camel case': 'camel',
    'pascal case': 'pascal',
    'snake case': 'snake',
    'kebab case': 'kebab',
    'constant case': 'constant',
  };
  const style = styleMap[match[1].toLowerCase()];
  return { style, remainder: match[2].trim() };
}

/** Default identifier casing for variables/functions vs types. */
export function identifierFromWords(words: string[], context: 'variable' | 'type' | 'react' = 'variable'): string {
  if (words.length === 0) return '';
  if (context === 'type') {
    return applyCasing(words, 'pascal');
  }
  if (context === 'react') {
    return applyCasing(words, 'pascal');
  }
  return applyCasing(words, 'camel');
}

/** Default import binding — camelCase for services; React is a special case. */
export function importDefaultIdentifier(nameWords: string[]): string {
  const key = nameWords.join(' ').toLowerCase().trim();
  if (key === 'react') return 'React';
  if (key.endsWith(' class')) {
    return identifierFromWords(nameWords.slice(0, -1), 'type');
  }
  return identifierFromWords(nameWords, 'variable');
}

/** export default App for component-like names. */
export function exportDefaultIdentifier(nameWords: string[]): string {
  return identifierFromWords(nameWords, 'react');
}
