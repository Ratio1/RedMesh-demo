'use client';

import { useState, useCallback } from 'react';

interface CopyableTextProps {
  text: string;
  className?: string;
  maxWidth?: string;
}

export default function CopyableText({ text, className = '', maxWidth = '180px' }: CopyableTextProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied!' : `Click to copy: ${text}`}
      className={`truncate text-left transition-colors hover:text-brand-primary ${className}`}
      style={{ maxWidth }}
    >
      {copied ? (
        <span className="text-emerald-400">Copied!</span>
      ) : (
        text
      )}
    </button>
  );
}
