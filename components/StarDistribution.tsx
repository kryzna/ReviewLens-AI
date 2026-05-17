import type { Session } from '@/lib/types';

export default function StarDistribution({ session }: { session: Session }) {
  const total = Object.values(session.ratingDist).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      {([5, 4, 3, 2, 1] as const).map(star => {
        const count = session.ratingDist[String(star) as '1' | '2' | '3' | '4' | '5'];
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={star} className="flex items-center gap-4">
            <span className="w-8 text-right font-medium text-sm">{star}★</span>
            <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-3 bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-12 text-right text-sm font-medium">{count.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}
