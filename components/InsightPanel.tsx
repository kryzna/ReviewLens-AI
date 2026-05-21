'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import QuoteStream from './QuoteStream';
import { InsightRadarSkeleton } from './InsightRadar';
import type { InsightRadarData } from '@/lib/types';

const InsightRadar = dynamic(() => import('./InsightRadar'), { ssr: false });

interface Props {
  sessionId: string;
}

export default function InsightPanel({ sessionId }: Props) {
  const [data, setData] = useState<InsightRadarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/insight`)
      .then((r) => r.json())
      .then((json) => {
        if (json.radar?.themes?.length) {
          setData(json.radar);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 mb-6">
      <h2 className="text-slate-200 text-sm font-semibold uppercase tracking-wider mb-4">
        Insight Radar
      </h2>

      {loading && <InsightRadarSkeleton />}

      {!loading && error && (
        <p className="text-slate-500 text-sm">Could not load themes — ask in chat.</p>
      )}

      {!loading && data && (
        <>
          <InsightRadar themes={data.themes} />
          <div className="mt-4 pt-4 border-t border-slate-800">
            <QuoteStream themes={data.themes} />
          </div>
          {data.summary && (
            <p className="text-slate-500 text-xs mt-3">{data.summary}</p>
          )}
        </>
      )}
    </div>
  );
}
