import type { Session } from '@/lib/types';
import StarDistribution from './StarDistribution';

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
    trustpilot: 'Trustpilot', appstore: 'App Store', googleplay: 'Google Play', upload: 'Upload',
  };
  return map[source] ?? source;
}

function renderStars(avg: number | null | undefined): string {
  if (avg == null) return '';
  const filled = Math.round(avg);
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

export default function SummaryCard({ session }: { session: Session }) {
  return (
    <div className="glass-card rounded-3xl p-8 mb-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <span className={`source-badge ${sourceBadgeClass(session.source)}`}>
            {sourceLabel(session.source)}
          </span>
          <h1 className="text-4xl font-display font-bold mt-3 mb-1">{session.subjectName}</h1>
          {session.sourceUrl && (
            <a
              href={session.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 text-sm hover:underline flex items-center gap-1"
            >
              View on source ↗
            </a>
          )}
        </div>
        {session.ratingAvg != null && (
          <div className="text-right">
            <div className="flex items-baseline gap-2 justify-end">
              <span className="text-5xl font-bold">{session.ratingAvg.toFixed(1)}</span>
              <span className="text-amber-400 text-xl">{renderStars(session.ratingAvg)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Reviews</p>
          <p className="text-3xl font-bold">{session.reviewCount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Verified</p>
          <p className="text-3xl font-bold">{session.verifiedCount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Date Range</p>
          <p className="text-lg font-bold mt-1">
            {session.dateMin && session.dateMax
              ? `${session.dateMin} – ${session.dateMax}`
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Session ID</p>
          <p className="text-sm font-bold mt-1 truncate text-slate-600">{session.id.slice(0, 8)}…</p>
        </div>
      </div>

      <p className="text-sm font-medium text-slate-500 mb-4">Rating Distribution</p>
      <StarDistribution session={session} />
    </div>
  );
}
