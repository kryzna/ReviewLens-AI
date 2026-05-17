import SessionSidebar from '@/components/SessionSidebar';
import NewSessionForm from '@/components/NewSessionForm';

export default function Home() {
  return (
    <div className="flex h-screen">
      <SessionSidebar />
      <main className="flex-1 overflow-auto">
        <NewSessionForm />
      </main>
    </div>
  );
}
