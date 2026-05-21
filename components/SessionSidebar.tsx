'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Session } from '@/lib/types';

function sourceBadgeClass(source: string): string {
  const map: Record<string, string> = {
    trustpilot: 'bg-emerald-100 text-emerald-700',
    appstore: 'bg-slate-100 text-slate-700',
    googleplay: 'bg-green-100 text-green-700',
    upload: 'bg-violet-100 text-violet-700',
  };
  return map[source] ?? 'bg-violet-100 text-violet-700';
}

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    trustpilot: 'Trustpilot',
    appstore: 'App Store',
    googleplay: 'Google Play',
    upload: 'Upload',
  };
  return map[source] ?? source;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SessionSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    fetch('/api/sessions')
      .then(r => r.json())
      .then((d: { sessions: Session[] }) => setSessions(d.sessions ?? []))
      .catch(console.error);
  }, [pathname]);

  const currentId = pathname?.startsWith('/session/') ? pathname.split('/')[2] : null;

  return (
    <aside className="w-80 bg-white border-r border-violet-100 flex flex-col h-screen">
      <div className="p-5 flex items-center gap-3">
        <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-cyan-500 rounded-2xl flex items-center justify-center text-white text-sm">
          &#128269;
        </div>
        <h1 className="text-2xl font-display font-bold">ReviewLens</h1>
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={() => router.push(pathname === '/' ? `/?new=${Date.now()}` : '/')}
          className="w-full py-3 bg-gradient-to-r from-violet-600 to-cyan-500 text-white rounded-2xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-violet-200"
        >
          + New Session
        </button>
      </div>

      <div className="px-5 pb-2 flex items-baseline gap-2">
        <span className="text-xs uppercase tracking-widest text-slate-700 font-semibold">Sessions</span>
        <span className="text-xs text-slate-400">{sessions.length} total</span>
      </div>

      <div className="flex-1 overflow-auto px-2 pb-4 space-y-1">
        {sessions.map(s => (
          <div
            key={s.id}
            onClick={() => router.push(`/session/${s.id}`)}
            className={`session-item group relative px-4 py-3 rounded-2xl cursor-pointer ${s.id === currentId ? 'active' : ''}`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="font-semibold text-slate-800 text-sm">{s.subjectName}</span>
              <div className="flex items-center gap-1">
                {s.ratingAvg != null && (
                  <span className="text-xs font-semibold text-violet-600">{s.ratingAvg.toFixed(1)}★</span>
                )}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setSessions(prev => prev.filter(x => x.id !== s.id));
                    if (s.id === currentId) router.push('/');
                    fetch(`/api/sessions/${s.id}`, { method: 'DELETE' }).catch(() => {});
                  }}
                  className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded text-slate-400 hover:text-red-500 transition-opacity"
                  aria-label="Delete session"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 112 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${sourceBadgeClass(s.source)}`}>
                {sourceLabel(s.source)}
              </span>
              <span className="text-xs text-slate-500">{s.reviewCount.toLocaleString()} reviews</span>
            </div>
            <p className="text-xs text-slate-400">{timeAgo(s.ingestedAt)}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}
