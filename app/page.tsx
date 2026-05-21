import SessionSidebar from '@/components/SessionSidebar';
import NewSessionForm from '@/components/NewSessionForm';

export default async function Home({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { new: newKey } = await searchParams;
  return (
    <div className="flex h-screen">
      <SessionSidebar />
      <main className="flex-1 overflow-auto">
        <NewSessionForm key={newKey ?? '0'} />
      </main>
    </div>
  );
}
