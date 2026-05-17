'use client';

import { useState, useEffect, useRef } from 'react';
import type { Message, Review } from '@/lib/types';
import CitationChip from './CitationChip';

const SUGGESTIONS = [
  'Most common complaints',
  'What do customers love most?',
  'Feedback on pricing',
  'Support quality feedback',
];

function parseContent(
  content: string,
  reviews: Review[]
): React.ReactNode[] {
  const reviewMap = new Map(reviews.map(r => [r.id, r]));
  const parts = content.split(/(\[r:[a-f0-9-]{36}\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[r:([a-f0-9-]{36})\]$/);
    if (match) {
      const review = reviewMap.get(match[1]);
      return <CitationChip key={i} reviewId={match[1]} sourceUrl={review?.sourceUrl} />;
    }
    return <span key={i}>{part}</span>;
  });
}

interface Props {
  sessionId: string;
  reviews: Review[];
  initialMessages: Message[];
}

export default function ChatPanel({ sessionId, reviews, initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setInput('');
    const userMsg: Message = {
      id: `tmp-${Date.now()}`,
      sessionId,
      role: 'user',
      content: text,
      citations: [],
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json() as { message?: Message; error?: string };
      if (data.message) {
        setMessages(prev => [...prev, data.message!]);
      }
    } catch {
      // keep user message visible, don't add error message
    } finally {
      setLoading(false);
    }
  }

  const isRefusal = (content: string) => content.startsWith('[refusal]');
  const stripRefusal = (content: string) => content.replace(/^\[refusal\]\s*/, '');

  return (
    <div className="glass-card rounded-3xl flex flex-col">
      <div className="p-6 space-y-6 min-h-[300px] max-h-[500px] overflow-y-auto">
        {messages.length === 0 && (
          <div className="chat-bubble">
            <div className="bg-white border border-violet-100 max-w-[80%] px-5 py-3 rounded-3xl text-slate-700">
              Ready to answer questions about these reviews. Ask me anything about customer sentiment, common themes, or specific feedback.
            </div>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`chat-bubble ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
            {msg.role === 'user' ? (
              <div className="bg-gradient-to-r from-violet-600 to-violet-500 text-white max-w-[75%] px-5 py-3 rounded-3xl shadow-md">
                {msg.content}
              </div>
            ) : isRefusal(msg.content) ? (
              <div className="refusal-bubble flex items-start gap-2">
                <span>🛡️</span>
                <span>{stripRefusal(msg.content)}</span>
              </div>
            ) : (
              <div className="bg-white border border-violet-100 max-w-[85%] px-5 py-3 rounded-3xl leading-relaxed">
                {parseContent(msg.content, reviews)}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="chat-bubble">
            <div className="bg-white border border-violet-100 px-5 py-3 rounded-3xl text-slate-400 w-fit animate-pulse">
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-6 pb-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map(s => (
          <button
            key={s}
            onClick={() => send(s)}
            className="px-4 py-2 bg-violet-50 text-violet-700 rounded-full text-sm hover:bg-violet-100"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-violet-100">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
            placeholder="Ask about the reviews…"
            className="flex-1 px-5 py-4 rounded-2xl border border-slate-200 focus:border-violet-500 outline-none"
          />
          <button
            onClick={() => send(input)}
            disabled={loading}
            className="bg-gradient-to-r from-violet-600 to-violet-500 text-white px-8 rounded-2xl font-medium shadow-lg shadow-violet-200 disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
