'use client';

import { useEffect, useState } from 'react';
import type { InsightRadarTheme } from '@/lib/types';

const BADGE = {
  positive: 'bg-green-900 text-green-300',
  negative: 'bg-red-900 text-red-300',
  mixed: 'bg-amber-900 text-amber-300',
};

interface Props {
  themes: InsightRadarTheme[];
}

export default function QuoteStream({ themes }: Props) {
  const quotes = themes.filter((t) => t.topQuote).slice(0, 6);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (quotes.length < 2) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % quotes.length);
        setVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, [quotes.length]);

  if (!quotes.length) return null;
  const current = quotes[idx];

  return (
    <div className="min-h-[64px] flex items-start gap-3 transition-opacity duration-400" style={{ opacity: visible ? 1 : 0 }}>
      <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${BADGE[current.sentiment]}`}>
        {current.sentiment}
      </span>
      <p className="text-slate-300 text-sm italic leading-snug">"{current.topQuote}"</p>
      <span className="shrink-0 text-slate-500 text-xs mt-0.5">— {current.name}</span>
    </div>
  );
}
