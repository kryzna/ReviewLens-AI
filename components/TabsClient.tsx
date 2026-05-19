'use client';

import { useState } from 'react';

interface Props {
  chatPanel: React.ReactNode;
  reviewsPanel: React.ReactNode;
  reviewCount: number;
}

export default function TabsClient({ chatPanel, reviewsPanel, reviewCount }: Props) {
  const [tab, setTab] = useState<'chat' | 'reviews'>('chat');

  return (
    <>
      <div className="flex gap-1 bg-white/60 p-1 rounded-2xl w-fit mb-6 border border-violet-100">
        <button
          onClick={() => setTab('chat')}
          className={`px-6 py-2 rounded-xl font-medium transition-all flex items-center gap-2 ${
            tab === 'chat' ? 'bg-white text-violet-700 shadow' : 'text-slate-500'
          }`}
        >
          💬 Chat
        </button>
        <button
          onClick={() => setTab('reviews')}
          className={`px-6 py-2 rounded-xl font-medium transition-all flex items-center gap-2 ${
            tab === 'reviews' ? 'bg-white text-violet-700 shadow' : 'text-slate-500'
          }`}
        >
          📄 Reviews <span className="text-sm">({reviewCount})</span>
        </button>
      </div>

      <div className={tab === 'chat' ? '' : 'hidden'}>{chatPanel}</div>
      <div className={tab === 'reviews' ? '' : 'hidden'}>{reviewsPanel}</div>
    </>
  );
}
