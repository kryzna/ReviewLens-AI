import { v4 as uuidv4 } from 'uuid';
import { getDb } from './client';
import type { Session, Review, Message } from '@/lib/types';

// ── Sessions ──────────────────────────────────────────────────────────────────

export function insertSession(
  session: Omit<Session, 'id'> & { id?: string }
): Session {
  const db = getDb();
  const id = session.id ?? uuidv4();
  db.prepare(`
    INSERT INTO sessions
      (id, source, source_url, subject_name, ingested_at,
       review_count, verified_count, date_min, date_max, rating_avg, rating_dist)
    VALUES
      (@id, @source, @sourceUrl, @subjectName, @ingestedAt,
       @reviewCount, @verifiedCount, @dateMin, @dateMax, @ratingAvg, @ratingDist)
  `).run({
    id,
    source: session.source,
    sourceUrl: session.sourceUrl ?? null,
    subjectName: session.subjectName,
    ingestedAt: session.ingestedAt,
    reviewCount: session.reviewCount,
    verifiedCount: session.verifiedCount,
    dateMin: session.dateMin ?? null,
    dateMax: session.dateMax ?? null,
    ratingAvg: session.ratingAvg ?? null,
    ratingDist: JSON.stringify(session.ratingDist),
  });
  return { ...session, id };
}

export function getSession(id: string): Session | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToSession(row);
}

export function listSessions(): Session[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM sessions ORDER BY ingested_at DESC').all() as Record<string, unknown>[];
  return rows.map(rowToSession);
}

function rowToSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    source: row.source as Session['source'],
    sourceUrl: (row.source_url as string) ?? undefined,
    subjectName: row.subject_name as string,
    ingestedAt: row.ingested_at as string,
    reviewCount: row.review_count as number,
    verifiedCount: row.verified_count as number,
    dateMin: (row.date_min as string) ?? undefined,
    dateMax: (row.date_max as string) ?? undefined,
    ratingAvg: (row.rating_avg as number) ?? null,
    ratingDist: JSON.parse(row.rating_dist as string),
  };
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export function insertReviews(sessionId: string, reviews: Omit<Review, 'id' | 'sessionId'>[]): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO reviews
      (id, session_id, source_review_id, author, rating, date, text, source_url, verified, extra)
    VALUES
      (@id, @sessionId, @sourceReviewId, @author, @rating, @date, @text, @sourceUrl, @verified, @extra)
  `);
  const insertMany = db.transaction((rows: typeof reviews) => {
    for (const r of rows) {
      stmt.run({
        id: uuidv4(),
        sessionId,
        sourceReviewId: r.sourceReviewId ?? null,
        author: r.author ?? null,
        rating: r.rating ?? null,
        date: r.date,
        text: r.text,
        sourceUrl: r.sourceUrl ?? null,
        verified: r.verified ? 1 : 0,
        extra: r.extra ? JSON.stringify(r.extra) : null,
      });
    }
  });
  insertMany(reviews);
}

export function getReviews(sessionId: string, offset = 0, limit = 20): Review[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM reviews WHERE session_id = ? ORDER BY date DESC LIMIT ? OFFSET ?'
  ).all(sessionId, limit, offset) as Record<string, unknown>[];
  return rows.map(rowToReview);
}

export function getAllReviews(sessionId: string): Review[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM reviews WHERE session_id = ? ORDER BY date DESC'
  ).all(sessionId) as Record<string, unknown>[];
  return rows.map(rowToReview);
}

function rowToReview(row: Record<string, unknown>): Review {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    sourceReviewId: (row.source_review_id as string) ?? undefined,
    author: (row.author as string) ?? undefined,
    rating: (row.rating as number) ?? null,
    date: row.date as string,
    text: row.text as string,
    sourceUrl: (row.source_url as string) ?? undefined,
    verified: row.verified === 1,
    extra: row.extra ? JSON.parse(row.extra as string) : undefined,
  };
}

// ── Messages ──────────────────────────────────────────────────────────────────

export function insertMessage(msg: Omit<Message, 'id'>): Message {
  const db = getDb();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO messages (id, session_id, role, content, citations, created_at)
    VALUES (@id, @sessionId, @role, @content, @citations, @createdAt)
  `).run({
    id,
    sessionId: msg.sessionId,
    role: msg.role,
    content: msg.content,
    citations: JSON.stringify(msg.citations),
    createdAt: msg.createdAt,
  });
  return { ...msg, id };
}

export function getMessages(sessionId: string): Message[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC'
  ).all(sessionId) as Record<string, unknown>[];
  return rows.map(r => ({
    id: r.id as string,
    sessionId: r.session_id as string,
    role: r.role as Message['role'],
    content: r.content as string,
    citations: JSON.parse(r.citations as string),
    createdAt: r.created_at as string,
  }));
}
