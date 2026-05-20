'use client';

import { useState, useEffect, useRef } from 'react';
import type { Message, Review, InsightBrief } from '@/lib/types';

const QUICK_START = [
  'What are the top 3 customer complaints?',
  'What do customers love most?',
  'How has sentiment changed over time?',
  'What themes appear in negative reviews?',
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

function sentimentBadgeClass(s: string): string {
  if (s.includes('positive')) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (s.includes('negative')) return 'text-red-700 bg-red-50 border-red-200';
  return 'text-amber-700 bg-amber-50 border-amber-200';
}

function sentimentDotClass(s: string): string {
  if (s.includes('positive')) return 'bg-emerald-500';
  if (s.includes('negative')) return 'bg-red-500';
  return 'bg-amber-500';
}

interface Props {
  sessionId: string;
  reviews: Review[];
  initialMessages: Message[];
}

const CITATIONS_INITIAL = 3;
const CITATIONS_STEP = 3;

export default function ChatPanel({ sessionId, reviews, initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [citationLimit, setCitationLimit] = useState<Map<string, number>>(new Map());

  const [insightBrief, setInsightBrief] = useState<InsightBrief | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const [insightSpinnerVisible, setInsightSpinnerVisible] = useState(false);
  const [insightExpanded, setInsightExpanded] = useState(false);

  const [followups, setFollowups] = useState<Map<string, string[]>>(new Map());
  const [followupsLoading, setFollowupsLoading] = useState<Set<string>>(new Set());

  const bottomRef = useRef<HTMLDivElement>(null);
  const reviewMap = new Map(reviews.map(r => [r.id, r]));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setInsightLoading(true);
    setInsightSpinnerVisible(false);
    const timer = setTimeout(() => setInsightSpinnerVisible(true), 500);
    fetch(`/api/sessions/${sessionId}/insight`)
      .then(r => r.ok ? r.json() as Promise<InsightBrief> : Promise.reject())
      .then(data => setInsightBrief(data))
      .catch(() => {})
      .finally(() => { clearTimeout(timer); setInsightLoading(false); setInsightSpinnerVisible(false); });
    return () => clearTimeout(timer);
  }, [sessionId]);

  function fetchFollowups(msgId: string, content: string) {
    setFollowupsLoading(prev => new Set([...prev, msgId]));
    fetch(`/api/sessions/${sessionId}/followups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assistantMessage: content }),
    })
      .then(r => r.ok ? r.json() as Promise<{ suggestions: string[] }> : Promise.reject())
      .then(d => setFollowups(prev => new Map([...prev, [msgId, d.suggestions]])))
      .catch(() => {})
      .finally(() => {
        setFollowupsLoading(prev => {
          const s = new Set(prev);
          s.delete(msgId);
          return s;
        });
      });
  }

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
              const finalMsg = data.message as Message;
              setMessages(prev => prev.map(m =>
                m.id === streamingId ? finalMsg : m
              ));
              fetchFollowups(finalMsg.id, finalMsg.content);
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

  function dismissFollowups(msgId: string) {
    setFollowups(prev => { const m = new Map(prev); m.delete(msgId); return m; });
  }

  const isRefusal = (content: string) => content.startsWith('[refusal]');
  const stripRefusal = (content: string) => content.replace(/^\[refusal\]\s*/, '');

  const lastAssistantMsgId = [...messages].reverse()
    .find(m => m.role === 'assistant' && !m.id.startsWith('streaming-'))?.id;

  return (
    <div className="glass-card rounded-3xl flex flex-col">

      {/* Proactive Insight Brief — pinned above scroll area, always visible */}
      {(insightSpinnerVisible || insightBrief) && (
        <div className="border-b border-violet-100 bg-gradient-to-br from-violet-50 to-purple-50 rounded-t-3xl overflow-hidden">
          <button
            onClick={() => setInsightExpanded(e => !e)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-violet-100/40 transition-colors"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base">✨</span>
              <span className="font-semibold text-slate-700 text-sm">AI Insights</span>
              {insightBrief && (
                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${sentimentBadgeClass(insightBrief.sentiment)}`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sentimentDotClass(insightBrief.sentiment)}`} />
                  {insightBrief.sentiment} · {insightBrief.score.toFixed(1)}★
                </span>
              )}
              {insightSpinnerVisible && (
                <span className="text-xs text-slate-400 animate-pulse">Analyzing reviews…</span>
              )}
            </div>
            <span className="text-slate-400 text-xs shrink-0 ml-2">{insightExpanded ? '▲' : '▼'}</span>
          </button>

          {insightExpanded && insightBrief && (
            <div className="px-4 pb-4 space-y-3">
              <p className="text-sm text-slate-600 italic border-l-2 border-violet-300 pl-3">
                {insightBrief.summary}
              </p>
              <div className="space-y-2">
                {insightBrief.themes.map((theme, i) => (
                  <div key={i} className="bg-white rounded-xl p-3 border border-violet-100 shadow-sm">
                    <p className="text-xs font-semibold text-violet-700 mb-1">
                      <span className="inline-flex w-4 h-4 items-center justify-center bg-violet-100 rounded-full mr-1.5 text-[10px]">{i + 1}</span>
                      {theme.title}
                    </p>
                    <p className="text-xs text-slate-600 mb-2">{theme.description}</p>
                    <blockquote className="text-xs text-slate-500 italic border-l-2 border-violet-200 pl-2">
                      &ldquo;{theme.quote}&rdquo;
                    </blockquote>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="p-6 space-y-4 min-h-[300px] max-h-[500px] overflow-y-auto">

        {/* Empty state with quick-start prompts */}
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="chat-bubble">
              <div className="bg-white border border-violet-100 max-w-[80%] px-5 py-3 rounded-3xl text-slate-700">
                Ready to analyze these reviews. Try one of these to get started:
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_START.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="px-4 py-2 bg-gradient-to-r from-violet-600 to-violet-500 text-white rounded-full text-sm font-medium hover:from-violet-700 hover:to-violet-600 shadow-sm shadow-violet-200 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
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
          const isLastAssistant = msg.id === lastAssistantMsgId;
          const chips = followups.get(msg.id);
          const chipsLoading = followupsLoading.has(msg.id);

          return (
            <div key={msg.id} className="space-y-2">
              <div className="chat-bubble">
                <div className="bg-white border border-violet-100 max-w-[85%] px-5 py-3 rounded-3xl leading-relaxed">
                  <p className="whitespace-pre-wrap">{text}</p>
                  {cited.length > 0 && (() => {
                    const limit = citationLimit.get(msg.id) ?? CITATIONS_INITIAL;
                    const visible = cited.slice(0, limit);
                    const remaining = cited.length - limit;
                    return (
                      <div className="mt-3 pt-3 border-t border-violet-50 space-y-2">
                        <p className="text-xs font-medium text-slate-400">Sources</p>
                        {visible.map((r, i) => (
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
                        {remaining > 0 && (
                          <button
                            onClick={() => setCitationLimit(prev => new Map(prev).set(msg.id, limit + CITATIONS_STEP))}
                            className="text-xs text-violet-500 hover:text-violet-700 font-medium"
                          >
                            Show {Math.min(remaining, CITATIONS_STEP)} more source{Math.min(remaining, CITATIONS_STEP) !== 1 ? 's' : ''}…
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Contextual follow-up chips — only for last assistant message */}
              {isLastAssistant && chipsLoading && (
                <div className="flex gap-2 pl-1">
                  <div className="h-7 w-36 bg-violet-100 rounded-full animate-pulse" />
                  <div className="h-7 w-28 bg-violet-100 rounded-full animate-pulse" />
                  <div className="h-7 w-32 bg-violet-100 rounded-full animate-pulse" />
                </div>
              )}
              {isLastAssistant && chips && chips.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-1">
                  {chips.map(chip => (
                    <button
                      key={chip}
                      onClick={() => { send(chip); dismissFollowups(msg.id); }}
                      className="px-3 py-1.5 bg-white border border-violet-200 text-violet-700 rounded-full text-xs font-medium hover:bg-violet-50 hover:border-violet-400 transition-colors shadow-sm"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}
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
