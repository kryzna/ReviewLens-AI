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
      .then((d: { sessions: Session[] }) => setSessions(d.sessions))
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
          onClick={() => router.push('/')}
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
            className={`session-item px-4 py-3 rounded-2xl cursor-pointer ${s.id === currentId ? 'active' : ''}`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="font-semibold text-slate-800 text-sm">{s.subjectName}</span>
              {s.ratingAvg != null && (
                <span className="text-xs font-semibold text-violet-600">{s.ratingAvg.toFixed(1)}★</span>
              )}
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
