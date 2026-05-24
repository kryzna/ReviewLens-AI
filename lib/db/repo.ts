import { v4 as uuidv4 } from 'uuid';
import { getPool, initDb } from './client';
import type { Session, Review, Message } from '@/lib/types';

async function db() {
  await initDb();
  return getPool();
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function insertSession(
  session: Omit<Session, 'id'> & { id?: string }
): Promise<Session> {
  const pool = await db();
  const id = session.id ?? uuidv4();
  await pool.query(
    `INSERT INTO sessions
       (id, source, source_url, file_name, requested_cap, subject_name, ingested_at,
        review_count, verified_count, date_min, date_max, rating_avg, rating_dist)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id,
      session.source,
      session.sourceUrl ?? null,
      session.fileName ?? null,
      session.requestedCap ?? null,
      session.subjectName,
      session.ingestedAt,
      session.reviewCount,
      session.verifiedCount,
      session.dateMin ?? null,
      session.dateMax ?? null,
      session.ratingAvg ?? null,
      JSON.stringify(session.ratingDist),
    ]
  );
  return { ...session, id };
}

export async function getSession(id: string): Promise<Session | null> {
  const pool = await db();
  const { rows } = await pool.query('SELECT * FROM sessions WHERE id = $1', [id]);
  if (!rows[0]) return null;
  return rowToSession(rows[0]);
}

export async function getInsightBrief(id: string): Promise<import('@/lib/types').InsightBrief | null> {
  try {
    const pool = await db();
    const { rows } = await pool.query('SELECT insight_brief FROM sessions WHERE id = $1', [id]);
    const raw = rows[0]?.insight_brief as string | null;
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveInsightBrief(id: string, brief: import('@/lib/types').InsightBrief): Promise<void> {
  try {
    const pool = await db();
    await pool.query('UPDATE sessions SET insight_brief = $1 WHERE id = $2', [JSON.stringify(brief), id]);
  } catch (err) {
    console.error('[saveInsightBrief] failed:', err);
  }
}

export async function deleteSession(id: string): Promise<void> {
  const pool = await db();
  await pool.query('DELETE FROM sessions WHERE id = $1', [id]);
}

export async function listSessions(): Promise<Session[]> {
  const pool = await db();
  const { rows } = await pool.query('SELECT * FROM sessions ORDER BY ingested_at DESC');
  return rows.map(rowToSession);
}

function rowToSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    source: row.source as Session['source'],
    sourceUrl: (row.source_url as string) ?? undefined,
    fileName: (row.file_name as string) ?? undefined,
    requestedCap: (row.requested_cap as number) ?? undefined,
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

// ── Session + Reviews (atomic) ────────────────────────────────────────────────

export async function insertSessionWithReviews(
  session: Omit<Session, 'id'> & { id?: string },
  reviews: Omit<Review, 'id' | 'sessionId'>[]
): Promise<Session> {
  const pool = await db();
  const client = await pool.connect();
  const id = session.id ?? uuidv4();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO sessions
         (id, source, source_url, file_name, requested_cap, subject_name, ingested_at,
          review_count, verified_count, date_min, date_max, rating_avg, rating_dist)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        id,
        session.source,
        session.sourceUrl ?? null,
        session.fileName ?? null,
        session.requestedCap ?? null,
        session.subjectName,
        session.ingestedAt,
        session.reviewCount,
        session.verifiedCount,
        session.dateMin ?? null,
        session.dateMax ?? null,
        session.ratingAvg ?? null,
        JSON.stringify(session.ratingDist),
      ]
    );
    for (const r of reviews) {
      await client.query(
        `INSERT INTO reviews
           (id, session_id, source_review_id, author, rating, date, text, source_url, verified, extra)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          uuidv4(),
          id,
          r.sourceReviewId ?? null,
          r.author ?? null,
          r.rating ?? null,
          r.date,
          r.text,
          r.sourceUrl ?? null,
          r.verified,
          r.extra ? JSON.stringify(r.extra) : null,
        ]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return { ...session, id };
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export async function insertReviews(
  sessionId: string,
  reviews: Omit<Review, 'id' | 'sessionId'>[]
): Promise<void> {
  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of reviews) {
      await client.query(
        `INSERT INTO reviews
           (id, session_id, source_review_id, author, rating, date, text, source_url, verified, extra)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          uuidv4(),
          sessionId,
          r.sourceReviewId ?? null,
          r.author ?? null,
          r.rating ?? null,
          r.date,
          r.text,
          r.sourceUrl ?? null,
          r.verified,
          r.extra ? JSON.stringify(r.extra) : null,
        ]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getReviews(sessionId: string, offset = 0, limit = 20): Promise<Review[]> {
  const pool = await db();
  const { rows } = await pool.query(
    'SELECT * FROM reviews WHERE session_id = $1 ORDER BY date DESC LIMIT $2 OFFSET $3',
    [sessionId, limit, offset]
  );
  return rows.map(rowToReview);
}

export async function getAllReviews(sessionId: string): Promise<Review[]> {
  const pool = await db();
  const { rows } = await pool.query(
    'SELECT * FROM reviews WHERE session_id = $1 ORDER BY date DESC',
    [sessionId]
  );
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
    verified: Boolean(row.verified),
    extra: row.extra ? JSON.parse(row.extra as string) : undefined,
  };
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function insertMessage(msg: Omit<Message, 'id'>): Promise<Message> {
  const pool = await db();
  const id = uuidv4();
  await pool.query(
    `INSERT INTO messages (id, session_id, role, content, citations, created_at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, msg.sessionId, msg.role, msg.content, JSON.stringify(msg.citations), msg.createdAt]
  );
  return { ...msg, id };
}

export async function getMessages(sessionId: string): Promise<Message[]> {
  const pool = await db();
  const { rows } = await pool.query(
    'SELECT * FROM messages WHERE session_id = $1 ORDER BY created_at ASC',
    [sessionId]
  );
  return rows.map(r => ({
    id: r.id as string,
    sessionId: r.session_id as string,
    role: r.role as Message['role'],
    content: r.content as string,
    citations: JSON.parse(r.citations as string),
    createdAt: r.created_at as string,
  }));
}
