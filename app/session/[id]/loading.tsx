import SessionSidebar from '@/components/SessionSidebar';

export default function Loading() {
  return (
    <div className="flex h-screen">
      <SessionSidebar />
      <main className="flex-1 overflow-auto p-8 space-y-6">
        <div className="animate-pulse space-y-4">
          {/* SummaryCard skeleton */}
          <div className="h-36 bg-violet-50 rounded-3xl" />
          {/* Tab bar skeleton */}
          <div className="flex gap-4">
            <div className="h-10 w-24 bg-violet-50 rounded-xl" />
            <div className="h-10 w-24 bg-violet-50 rounded-xl" />
          </div>
          {/* Chat panel skeleton */}
          <div className="h-[500px] bg-violet-50 rounded-3xl" />
        </div>
      </main>
    </div>
  );
}
