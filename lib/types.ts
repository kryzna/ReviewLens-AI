export type Source = 'trustpilot' | 'appstore' | 'googleplay' | 'capterra' | 'upload';

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
  fileName?: string;
  requestedCap?: number;
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

export type ProgressEvent =
  | { type: 'navigating'; source: string }
  | { type: 'page-start'; pageNum: number; totalPages: number }
  | { type: 'page-done'; pageNum: number; totalPages: number; reviewCount: number }
  | { type: 'extracting'; count: number; cap: number };

export type ProgressCallback = (evt: ProgressEvent) => void;

export interface Scraper {
  matches(url: string): boolean;
  scrape(url: string, cap: number, onProgress?: ProgressCallback): Promise<ScrapeResult>;
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

export interface InsightTheme {
  title: string;
  description: string;
  quote: string;
}

export interface InsightRadarTheme {
  name: string;
  score: number;
  count: number;
  sentiment: 'positive' | 'negative' | 'mixed';
  topQuote: string;
}

export interface InsightRadarData {
  themes: InsightRadarTheme[];
  summary: string;
  ingestedAt: string;
}

export interface InsightBrief {
  sentiment: string;
  score: number;
  summary: string;
  themes: InsightTheme[];
  radar?: InsightRadarData;
}
