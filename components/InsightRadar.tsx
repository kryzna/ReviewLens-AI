'use client';

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { InsightRadarTheme } from '@/lib/types';

function sentimentColor(s: 'positive' | 'negative' | 'mixed') {
  if (s === 'positive') return '#22c55e';
  if (s === 'negative') return '#ef4444';
  return '#f59e0b';
}

interface Props {
  themes: InsightRadarTheme[];
}

export default function InsightRadar({ themes }: Props) {
  const data = themes.map((t) => ({ subject: t.name, score: t.score, sentiment: t.sentiment }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data}>
        <PolarGrid stroke="#334155" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
        <Radar
          name="Score"
          dataKey="score"
          stroke="#6366f1"
          fill="#6366f1"
          fillOpacity={0.25}
          dot={(props: any) => {
            const theme = themes[props.index];
            return (
              <circle
                key={props.index}
                cx={props.cx}
                cy={props.cy}
                r={4}
                fill={sentimentColor(theme.sentiment)}
                stroke="none"
              />
            );
          }}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const idx = data.findIndex((d) => d.subject === payload[0]?.payload?.subject);
            const theme = themes[idx];
            if (!theme) return null;
            return (
              <div className="bg-slate-800 border border-slate-700 rounded p-2 text-xs max-w-[200px]">
                <p className="font-semibold text-white">{theme.name}</p>
                <p className="text-slate-400">{theme.count} reviews · score {theme.score}</p>
                <p className="text-slate-300 mt-1 italic">"{theme.topQuote}"</p>
              </div>
            );
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function InsightRadarSkeleton() {
  return (
    <div className="w-full h-[280px] flex items-center justify-center">
      <div className="w-48 h-48 rounded-full border border-slate-700 animate-pulse" />
    </div>
  );
}
