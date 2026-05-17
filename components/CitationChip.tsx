'use client';

interface CitationChipProps {
  reviewId: string;
  sourceUrl?: string;
}

export default function CitationChip({ reviewId, sourceUrl }: CitationChipProps) {
  function handleClick(e: React.MouseEvent) {
    if (e.metaKey || e.ctrlKey) {
      if (sourceUrl) window.open(sourceUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const el = document.getElementById(`review-${reviewId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <span
      className="citation-chip"
      onClick={handleClick}
      title={sourceUrl ? 'Click to scroll • Cmd+click to open source' : 'Click to scroll to review'}
    >
      [r:{reviewId.slice(0, 6)}]
    </span>
  );
}
