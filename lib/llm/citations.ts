const CITATION_RE = /\[r:([a-f0-9-]{36})\]/g;

export function parseCitations(text: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = CITATION_RE.exec(text)) !== null) {
    if (!seen.has(match[1])) {
      ids.push(match[1]);
      seen.add(match[1]);
    }
  }
  return ids;
}
