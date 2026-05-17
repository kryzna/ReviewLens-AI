import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReviewLens AI',
  description: 'AI-powered review analysis',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gradient-to-br from-violet-50 to-sky-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
