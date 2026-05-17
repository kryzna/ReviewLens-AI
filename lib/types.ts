export type Source = 'trustpilot' | 'appstore' | 'googleplay' | 'upload';

export interface Review {
  id: string;
  sessionId: string;
  sourceReviewId?: string;
  author?: string;
  rating: number | null;
  date: string;
  text: string;
  sourceUrl?: string;
  verified: boolean;
  extra?: Record<string, unknown>;
}

export interface Session {
  id: string;
  source: Source;
  sourceUrl?: string;
  subjectName: string;
  ingestedAt: string;
  reviewCount: number;
  verifiedCount: number;
  dateMin?: string;
  dateMax?: string;
  ratingAvg?: number | null;
  ratingDist: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  citations: string[];
  createdAt: string;
}

export interface ScrapeResult {
  subjectName: string;
  sourceUrl: string;
  reviews: Omit<Review, 'id' | 'sessionId'>[];
}

export interface Scraper {
  matches(url: string): boolean;
  scrape(url: string, cap: number): Promise<ScrapeResult>;
}

export class ScraperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScraperError';
  }
}

export class IngestError extends Error {
  constructor(
    message: string,
    public rowErrors?: { row: number; error: string }[]
  ) {
    super(message);
    this.name = 'IngestError';
  }
}
