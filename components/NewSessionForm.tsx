'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function NewSessionForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragover, setDragover] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function ingestUrl() {
    if (!url.trim()) { setError('Enter a URL.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json() as { sessionId?: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'Ingest failed.'); return; }
      router.push(`/session/${data.sessionId}`);
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
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
        <p className="text-xs text-slate-500 mb-6">Supports Trustpilot, Apple App Store, and Google Play URLs</p>

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
      </div>
    </div>
  );
}
