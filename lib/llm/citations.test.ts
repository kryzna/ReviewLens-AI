import { parseCitations } from './citations';

describe('parseCitations', () => {
  it('extracts UUIDs from citation tokens', () => {
    const text = 'Good product [r:550e8400-e29b-41d4-a716-446655440000] and fast [r:6ba7b810-9dad-11d1-80b4-00c04fd430c8].';
    expect(parseCitations(text)).toEqual([
      '550e8400-e29b-41d4-a716-446655440000',
      '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    ]);
  });

  it('deduplicates repeated citations', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    expect(parseCitations(`[r:${id}] and [r:${id}]`)).toEqual([id]);
  });

  it('returns empty array when no citations', () => {
    expect(parseCitations('No citations here.')).toEqual([]);
  });
});
