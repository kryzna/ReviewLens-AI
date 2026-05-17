'use client';

import { useState } from 'react';
import type { Review } from '@/lib/types';

type Filter = 'all' | '1' | '2' | '3' | '4' | '5';

function Stars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-slate-400 text-sm">Unrated</span>;
  return (
    <span className="text-xl text-amber-400">
      {'★'.repeat(rating)}
      <span className="text-slate-200">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

interface Props {
  reviews: Review[];
  totalCount: number;
  sessionId: string;
}

export default function ReviewsPanel({ reviews: initial, totalCount, sessionId }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [reviews, setReviews] = useState(initial);
  const [offset, setOffset] = useState(initial.length);
  const [loading, setLoading] = useState(false);

  const filtered = filter === 'all' ? reviews : reviews.filter(r => String(r.rating) === filter);

  async function loadMore() {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}?offset=${offset}&limit=20`);
      const data = await res.json() as { reviews: Review[] };
      setReviews(prev => [...prev, ...data.reviews]);
      setOffset(o => o + data.reviews.length);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        {(['all', '5', '4', '3', '2', '1'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              filter === f
                ? 'bg-violet-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-violet-300'
            }`}
          >
            {f === 'all' ? 'All' : `${f}★`}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map(r => (
          <div key={r.id} id={`review-${r.id}`} className="glass-card rounded-3xl p-6 scroll-mt-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <Stars rating={r.rating} />
                <p className="text-sm text-slate-500 mt-1">
                  {r.author ?? 'Anonymous'}
                  {r.verified && <span className="ml-2 text-emerald-600 text-xs font-medium">✓ Verified</span>}
                  <span className="text-xs text-slate-400 ml-2">[{r.id.slice(0, 6)}]</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{r.date}</span>
                {r.sourceUrl && (
                  <a
                    href={r.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-violet-600 hover:underline"
                  >
                    ↗ Source
                  </a>
                )}
              </div>
            </div>
            <p className="text-slate-700">{r.text}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-slate-500 mt-6 text-center">
        Showing {filtered.length} of {filter === 'all' ? totalCount : filtered.length}
      </p>

      {filter === 'all' && offset < totalCount && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="mt-4 w-full py-3 border border-violet-200 text-violet-600 rounded-2xl hover:bg-violet-50 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
