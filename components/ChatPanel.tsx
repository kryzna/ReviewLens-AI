'use client';

import { useState, useEffect, useRef } from 'react';
import type { Message, Review } from '@/lib/types';

const SUGGESTIONS = [
  'Most common complaints',
  'What do customers love most?',
  'Feedback on pricing',
  'Support quality feedback',
];

function parseMessage(content: string): { text: string; citationIds: string[] } {
  const ids: string[] = [];
  const text = content.replace(/\[r:[a-f0-9-]{36}\]/g, (match) => {
    const id = match.slice(3, -1);
    if (!ids.includes(id)) ids.push(id);
    return '';
  }).replace(/\s{2,}/g, ' ').trim();
  return { text, citationIds: ids };
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
  const reviewMap = new Map(reviews.map(r => [r.id, r]));

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

    const streamingId = `streaming-${Date.now()}`;
    const streamingMsg: Message = {
      id: streamingId,
      sessionId,
      role: 'assistant',
      content: '',
      citations: [],
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg, streamingMsg]);
    setLoading(true);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });

      if (!res.body) throw new Error('No stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let event = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            event = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (event === 'token') {
              setMessages(prev => prev.map(m =>
                m.id === streamingId ? { ...m, content: m.content + data.text } : m
              ));
            } else if (event === 'done') {
              setMessages(prev => prev.map(m =>
                m.id === streamingId ? data.message : m
              ));
            } else if (event === 'error') {
              setMessages(prev => prev.map(m =>
                m.id === streamingId ? { ...m, content: data.message } : m
              ));
            }
            event = '';
          }
        }
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== streamingId));
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
        {messages.map(msg => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="chat-bubble flex justify-end">
                <div className="bg-gradient-to-r from-violet-600 to-violet-500 text-white max-w-[75%] px-5 py-3 rounded-3xl shadow-md">
                  {msg.content}
                </div>
              </div>
            );
          }

          if (isRefusal(msg.content)) {
            return (
              <div key={msg.id} className="chat-bubble">
                <div className="refusal-bubble flex items-start gap-2">
                  <span>🛡️</span>
                  <span>{stripRefusal(msg.content)}</span>
                </div>
              </div>
            );
          }

          const { text, citationIds } = parseMessage(msg.content);
          const cited = citationIds.map(id => reviewMap.get(id)).filter(Boolean) as Review[];

          return (
            <div key={msg.id} className="chat-bubble">
              <div className="bg-white border border-violet-100 max-w-[85%] px-5 py-3 rounded-3xl leading-relaxed">
                <p className="whitespace-pre-wrap">{text}</p>
                {cited.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-violet-50 space-y-2">
                    <p className="text-xs font-medium text-slate-400">Sources</p>
                    {cited.map((r, i) => (
                      <div key={r.id} className="text-xs text-slate-500 bg-violet-50 rounded-xl px-3 py-2">
                        <span className="font-medium text-violet-700">#{i + 1}</span>
                        {r.author && <span className="ml-1 text-slate-600">{r.author}</span>}
                        {r.rating && <span className="ml-1">· {r.rating}★</span>}
                        {r.sourceUrl
                          ? <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-violet-500 underline">{r.text.slice(0, 80)}…</a>
                          : <span className="ml-2">{r.text.slice(0, 80)}…</span>
                        }
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {loading && messages[messages.length - 1]?.content === '' && (
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
          <button key={s} onClick={() => send(s)} className="px-4 py-2 bg-violet-50 text-violet-700 rounded-full text-sm hover:bg-violet-100">
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
