/** Check whether a file path matches configured protected globs. */
export function isProtectedPath(filePath: string, globs: string[] = []): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  for (const glob of globs) {
    const pattern = glob.toLowerCase().replace(/\*\*/g, '§').replace(/\*/g, '[^/]*').replace(/§/g, '.*');
    if (new RegExp(pattern).test(normalized)) return true;
    if (glob.includes('.env') && normalized.includes('.env')) return true;
    if (glob.includes('secrets') && normalized.includes('/secrets/')) return true;
  }
  return false;
}
