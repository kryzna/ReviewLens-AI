'use client';

import { useState } from 'react';

export default function CopyableId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      onClick={copy}
      title={`Click to copy: ${id}`}
      className="mt-1 font-mono text-xs text-slate-600 text-left break-all hover:text-violet-600 transition-colors"
    >
      {copied ? <span className="text-emerald-600 font-medium">Copied!</span> : id}
    </button>
  );
}
