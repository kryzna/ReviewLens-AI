'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

type Step = { label: string; status: 'done' | 'active' };
type PageStatus = { pageNum: number; status: 'loading' | 'done'; reviewCount?: number };

export default function NewSessionForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [cap, setCap] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragover, setDragover] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [pages, setPages] = useState<PageStatus[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

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
      const { sessionId } = JSON.parse(e.data) as { sessionId: string };
      setSteps(prev => prev.map(s => ({ ...s, status: 'done' as const })));
      setLoading(false);
      router.push(`/session/${sessionId}`);
    });

    es.addEventListener('error', (e) => {
      es.close();
      setLoading(false);
      try {
        const { message } = JSON.parse((e as MessageEvent).data) as { message: string };
        setError(message);
      } catch {
        setError('Ingest failed. Check the URL and try again.');
      }
      setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'done' as const } : s));
    });
  }

  async function ingestFile(file: File) {
    setLoading(true); setError('');
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/sessions', { method: 'POST', body: form });
      const data = await res.json() as { sessionId?: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'Upload failed.'); return; }
      router.push(`/session/${data.sessionId}`);
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-display font-bold mb-3">Start a New Analysis Session</h1>
        <p className="text-slate-500">Import reviews from Trustpilot, App Store, or Google Play — or upload your own data</p>
      </div>

      <div className="glass-card rounded-3xl p-8 shadow-xl shadow-violet-100">
        <label className="block text-sm font-medium text-slate-700 mb-2">Review Source URL</label>
        <div className="relative mb-2">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">🔗</span>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ingestUrl()}
            placeholder="https://www.trustpilot.com/review/example.com"
            className="w-full pl-12 pr-5 py-4 rounded-2xl border border-slate-200 focus:border-violet-500 outline-none"
          />
        </div>
        <p className="text-xs text-slate-500 mb-4">Supports Trustpilot, Apple App Store, and Google Play URLs</p>

        <div className="flex items-center gap-3 mb-6">
          <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Max reviews</label>
          <input
            type="number"
            min={1}
            max={500}
            value={cap}
            onChange={e => setCap(Math.min(500, Math.max(1, parseInt(e.target.value) || 1)))}
            className="w-24 px-3 py-2 rounded-xl border border-slate-200 focus:border-violet-500 outline-none text-sm"
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
          className={`dropzone border-2 border-dashed border-violet-200 rounded-2xl p-12 text-center cursor-pointer hover:border-violet-400 ${dragover ? 'dragover' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragover(true); }}
          onDragLeave={() => setDragover(false)}
          onDrop={e => {
            e.preventDefault(); setDragover(false);
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
            onChange={e => { const f = e.target.files?.[0]; if (f) ingestFile(f); }}
          />
        </div>

        <div className="mt-6 p-4 bg-violet-50 rounded-2xl">
          <p className="text-sm font-medium text-violet-700 mb-1">Required fields for upload:</p>
          <code className="text-sm text-slate-700">author, rating, date, text, source_url (optional)</code>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <button
          onClick={ingestUrl}
          disabled={loading}
          className="mt-6 w-full py-4 bg-gradient-to-r from-violet-600 to-violet-500 text-white rounded-2xl font-medium flex items-center justify-center gap-3 shadow-lg shadow-violet-200 disabled:opacity-60"
        >
          {loading ? 'Importing…' : '↑ Ingest Reviews'}
        </button>

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
              Fetching {pages.length} page{pages.length > 1 ? 's' : ''} in parallel
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
