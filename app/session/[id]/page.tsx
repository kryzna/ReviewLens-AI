import { notFound } from 'next/navigation';
import SessionSidebar from '@/components/SessionSidebar';
import SummaryCard from '@/components/SummaryCard';
import ChatPanel from '@/components/ChatPanel';
import ReviewsPanel from '@/components/ReviewsPanel';
import TabsClient from '@/components/TabsClient';
import { getSession, getReviews, getAllReviews, getMessages } from '@/lib/db/repo';

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();

  const reviews = await getReviews(id, 0, 20);
  const allReviews = await getAllReviews(id);
  const messages = await getMessages(id);

  return (
    <div className="flex h-screen">
      <SessionSidebar />
      <main className="flex-1 overflow-auto p-8">
        <SummaryCard session={session} />
        <TabsClient
          reviewCount={session.reviewCount}
          chatPanel={
            <ChatPanel sessionId={id} reviews={allReviews} initialMessages={messages} />
          }
          reviewsPanel={
            <ReviewsPanel reviews={reviews} totalCount={session.reviewCount} sessionId={id} />
          }
        />
      </main>
    </div>
  );
}
