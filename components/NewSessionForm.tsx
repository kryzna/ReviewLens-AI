'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@/lib/types';

type Step = { label: string; status: 'done' | 'active' };
type PageStatus = { pageNum: number; status: 'loading' | 'done'; reviewCount?: number };
type IngestResult = { sessionId: string; session: Session };

function sourceBadgeClass(source: string): string {
  const map: Record<string, string> = {
    trustpilot: 'bg-emerald-100 text-emerald-700',
    capterra: 'bg-orange-100 text-orange-700',
    g2: 'bg-red-100 text-red-700',
    appstore: 'bg-slate-100 text-slate-700',
    googleplay: 'bg-green-100 text-green-700',
    upload: 'bg-violet-100 text-violet-700',
  };
  return map[source] ?? 'bg-violet-100 text-violet-700';
}

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    trustpilot: 'Trustpilot', capterra: 'Capterra', g2: 'G2',
    appstore: 'App Store', googleplay: 'Google Play', upload: 'CSV / JSONL Upload',
  };
  return map[source] ?? source;
}

function renderStars(avg: number | null | undefined): string {
  if (avg == null) return '';
  const filled = Math.round(avg);
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

export default function NewSessionForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [cap, setCap] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragover, setDragover] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [pages, setPages] = useState<PageStatus[]>([]);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function cancelIngest() {
    esRef.current?.close();
    esRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setSteps([]);
    setPages([]);
    setError('');
  }

  async function fetchAndShowSummary(sessionId: string) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}?limit=0`);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json() as { session: Session };
      setIngestResult({ sessionId, session: data.session });
    } catch {
      router.push(`/session/${sessionId}`);
    }
  }

  function pushStep(label: string) {
    setSteps(prev => [
      ...prev.map(s => s.status === 'active' ? { ...s, status: 'done' as const } : s),
      { label, status: 'active' },
    ]);
  }

  async function ingestUrl() {
    if (!url.trim()) { setError('Enter a URL.'); return; }
    setLoading(true); setError(''); setSteps([]); setPages([]);

    const es = new EventSource(`/api/sessions/stream?url=${encodeURIComponent(url)}&cap=${cap}`);
    esRef.current = es;

    es.addEventListener('navigating', (e) => {
      const { message } = JSON.parse(e.data) as { message: string };
      pushStep(message);
    });

    es.addEventListener('page-start', (e) => {
      const { pageNum, totalPages } = JSON.parse(e.data) as { pageNum: number; totalPages: number };
      setPages(prev => {
        // Initialise all slots on first page-start if totalPages known
        if (prev.length === 0 && totalPages > 1) {
          const slots: PageStatus[] = Array.from({ length: totalPages }, (_, i) => ({
            pageNum: i + 1,
            status: 'loading',
          }));
          return slots;
        }
        // Mark this page as loading if not already present
        if (prev.find(p => p.pageNum === pageNum)) return prev;
        return [...prev, { pageNum, status: 'loading' }];
      });
    });

    es.addEventListener('page-done', (e) => {
      const { pageNum, totalPages, reviewCount } = JSON.parse(e.data) as { pageNum: number; totalPages: number; reviewCount: number };
      setPages(prev => {
        const updated = prev.map(p =>
          p.pageNum === pageNum ? { ...p, status: 'done' as const, reviewCount } : p
        );
        // Ensure page exists (handles page 1 whose page-start had totalPages=1)
        if (!updated.find(p => p.pageNum === pageNum)) {
          return [...Array.from({ length: totalPages }, (_, i) => ({
            pageNum: i + 1,
            status: (i + 1 === pageNum ? 'done' : 'loading') as 'done' | 'loading',
            reviewCount: i + 1 === pageNum ? reviewCount : undefined,
          }))];
        }
        return updated;
      });
    });

    es.addEventListener('saving', (e) => {
      const { message } = JSON.parse(e.data) as { message: string };
      pushStep(message);
    });

    es.addEventListener('done', (e) => {
      es.close();
      esRef.current = null;
      const { sessionId } = JSON.parse(e.data) as { sessionId: string };
      setSteps(prev => prev.map(s => ({ ...s, status: 'done' as const })));
      setLoading(false);
      void fetchAndShowSummary(sessionId);
    });

    es.addEventListener('error', (e) => {
      es.close();
      esRef.current = null;
      setLoading(false);
      try {
        const { message } = JSON.parse((e as MessageEvent).data) as { message: string };
        setError(message);
      } catch {
        setError('Ingest failed. Check the URL and try again.');
      }
      setSteps([]);
      setPages([]);
    });
  }

  async function ingestFile(file: File) {
    setLoading(true); setError(''); setSteps([]);
    setSteps([{ label: `Uploading ${file.name}…`, status: 'active' }]);
    const controller = new AbortController();
    abortRef.current = controller;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/sessions', { method: 'POST', body: form, signal: controller.signal });
      const data = await res.json() as { sessionId?: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'Upload failed.'); setSteps([]); return; }
      setSteps([
        { label: `Uploaded ${file.name}`, status: 'done' },
        { label: 'Generating Insight Radar…', status: 'active' },
      ]);
      void fetchAndShowSummary(data.sessionId!);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Network error.');
        setSteps([]);
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }

  // ── Ingestion result summary screen ──────────────────────
  if (ingestResult) {
    const { sessionId, session } = ingestResult;
    const hasRating = session.ratingAvg != null;
    return (
      <div className="max-w-2xl mx-auto py-12 px-8">
        <div className="glass-card rounded-3xl p-8 shadow-xl shadow-violet-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-lg shrink-0">✓</div>
            <div>
              <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Ingestion complete</p>
              <h2 className="text-2xl font-display font-bold leading-tight">{session.subjectName}</h2>
            </div>
            <span className={`ml-auto px-3 py-1 rounded-full text-xs font-medium ${sourceBadgeClass(session.source)}`}>
              {sourceLabel(session.source)}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 rounded-2xl">
            <div className="text-center">
              <p className="text-3xl font-bold text-violet-700">{session.reviewCount.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">Reviews</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-violet-700">{session.verifiedCount.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">Verified</p>
            </div>
            <div className="text-center">
              {hasRating ? (
                <>
                  <p className="text-3xl font-bold text-violet-700">{session.ratingAvg!.toFixed(1)}</p>
                  <p className="text-xs text-amber-500 mt-1">{renderStars(session.ratingAvg)}</p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-bold text-slate-400">—</p>
                  <p className="text-xs text-slate-500 mt-1">Avg Rating</p>
                </>
              )}
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-violet-700 mt-1">
                {session.dateMin && session.dateMax
                  ? <>{session.dateMin}<br /><span className="text-slate-400">→</span><br />{session.dateMax}</>
                  : <span className="text-slate-400">—</span>}
              </p>
              <p className="text-xs text-slate-500 mt-1">Date Range</p>
            </div>
          </div>

          {session.reviewCount === 0 && (
            <p className="mb-4 text-sm text-amber-600 bg-amber-50 rounded-xl px-4 py-2">
              No reviews were imported. Check your file format or URL and try again.
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setIngestResult(null)}
              className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-600 text-sm font-medium hover:border-slate-300"
            >
              ← Start over
            </button>
            <button
              onClick={() => router.push(`/session/${sessionId}`)}
              disabled={session.reviewCount === 0}
              className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-violet-500 text-white rounded-2xl font-medium text-sm shadow-lg shadow-violet-200 disabled:opacity-50"
            >
              Start Analysis →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-display font-bold mb-3">Start a New Analysis Session</h1>
        <p className="text-slate-500">Import reviews from Trustpilot, Capterra, G2, or Google Play — or upload your own data</p>
      </div>

      <div className="glass-card rounded-3xl p-8 shadow-xl shadow-violet-100">
        <label className="block text-sm font-medium text-slate-700 mb-2">Review Source URL</label>
        <div className="relative mb-2">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">🔗</span>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && ingestUrl()}
            placeholder="Trustpilot, Capterra, G2, or Google Play URL"
            disabled={loading}
            className="w-full pl-12 pr-12 py-4 rounded-2xl border border-slate-200 focus:border-violet-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {loading && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2">
              <svg className="animate-spin h-5 w-5 text-violet-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mb-4">Supports Trustpilot, Capterra, G2, and Google Play URLs</p>

        <div className="flex items-center gap-3 mb-6">
          <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Max reviews</label>
          <input
            type="number"
            min={1}
            max={500}
            value={cap}
            onChange={e => setCap(Math.min(500, Math.max(1, parseInt(e.target.value) || 1)))}
            disabled={loading}
            className="w-24 px-3 py-2 rounded-xl border border-slate-200 focus:border-violet-500 outline-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className="text-xs text-slate-400">(max 500)</span>
        </div>

        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-slate-400 text-sm">or</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <label className="block text-sm font-medium text-slate-700 mb-2">Upload Review Data</label>
        <div
          className={`dropzone border-2 border-dashed border-violet-200 rounded-2xl p-12 text-center ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-violet-400'} ${dragover ? 'dragover' : ''}`}
          onClick={() => { if (!loading) fileRef.current?.click(); }}
          onDragOver={e => { e.preventDefault(); if (!loading) setDragover(true); }}
          onDragLeave={() => setDragover(false)}
          onDrop={e => {
            e.preventDefault(); setDragover(false);
            if (loading) return;
            const file = e.dataTransfer.files[0];
            if (file) ingestFile(file);
          }}
        >
          <div className="w-16 h-16 mx-auto mb-4 bg-violet-50 rounded-2xl flex items-center justify-center text-2xl">☁️</div>
          <p className="font-medium text-slate-700">Drag & drop your CSV or JSONL file here</p>
          <p className="text-sm text-slate-500 mt-1">or click to browse</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.jsonl"
            className="hidden"
            disabled={loading}
            onChange={e => { const f = e.target.files?.[0]; if (f) ingestFile(f); }}
          />
        </div>

        <div className="mt-4 p-4 bg-violet-50 rounded-2xl">
          <p className="text-sm font-medium text-violet-700 mb-2">Required columns: <code className="font-mono">text</code>, <code className="font-mono">date</code> &nbsp;·&nbsp; Optional: <code className="font-mono">author</code>, <code className="font-mono">rating</code> (1–5), <code className="font-mono">source_url</code>, <code className="font-mono">verified</code></p>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={async () => {
                const res = await fetch('/reviews.csv');
                const blob = await res.blob();
                ingestFile(new File([blob], 'reviews.csv', { type: 'text/csv' }));
              }}
              disabled={loading}
              className="text-xs font-medium text-violet-700 hover:text-violet-900 underline underline-offset-2 disabled:opacity-50"
            >
              ▶ Try sample data (15 reviews)
            </button>
            <span className="text-violet-300">·</span>
            <a href="/reviews.csv" download className="text-xs text-violet-600 hover:text-violet-800 underline underline-offset-2">⬇ Download CSV</a>
            <span className="text-violet-300">·</span>
            <a href="/template.csv" download className="text-xs text-violet-600 hover:text-violet-800 underline underline-offset-2">CSV template</a>
            <span className="text-violet-300">·</span>
            <a href="/template.jsonl" download className="text-xs text-violet-600 hover:text-violet-800 underline underline-offset-2">JSONL template</a>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button
            onClick={ingestUrl}
            disabled={loading}
            className="flex-1 py-4 bg-gradient-to-r from-violet-600 to-violet-500 text-white rounded-2xl font-medium flex items-center justify-center gap-3 shadow-lg shadow-violet-200 disabled:opacity-60"
          >
            {loading ? 'Importing…' : '↑ Ingest Reviews'}
          </button>
          {loading && (
            <button
              onClick={cancelIngest}
              className="px-5 py-4 rounded-2xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50"
            >
              ✕ Cancel
            </button>
          )}
        </div>

        {steps.length > 0 && (
          <ol className="mt-4 space-y-2">
            {steps.map((step, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  step.status === 'done' ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-600 animate-pulse'
                }`}>
                  {step.status === 'done' ? '✓' : i + 1}
                </span>
                <span className={step.status === 'active' ? 'text-slate-700 font-medium' : 'text-slate-500'}>
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
        )}

        {pages.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-500 mb-2">
              {(() => {
                const active = [...pages].reverse().find(p => p.status === 'loading');
                return active
                  ? `Fetching page ${active.pageNum} of ${pages.length}`
                  : `Fetched ${pages.length} page${pages.length > 1 ? 's' : ''}`;
              })()}
            </p>
            <div className="flex flex-wrap gap-2">
              {pages.map(p => (
                <div
                  key={p.pageNum}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border ${
                    p.status === 'done'
                      ? 'bg-violet-50 border-violet-200 text-violet-700'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    p.status === 'done' ? 'bg-violet-500' : 'bg-slate-400 animate-pulse'
                  }`} />
                  Page {p.pageNum}
                  {p.status === 'done' && p.reviewCount !== undefined && (
                    <span className="text-violet-500">· {p.reviewCount}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
