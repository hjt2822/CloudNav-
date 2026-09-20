import React, { useState, useEffect } from 'react';
import { getFaviconCandidates } from '../services/favicon';

interface FaviconProps {
  url?: string;
  icon?: string;
  title: string;
  className?: string;
  letterClassName?: string;
}

const LETTER_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-600', 'bg-indigo-500', 'bg-teal-500',
  'bg-fuchsia-500', 'bg-orange-500',
];

const colorFor = (title: string): string => {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  return LETTER_COLORS[hash % LETTER_COLORS.length];
};

// Multi-source fallback icon: custom icon -> each candidate source in order -> first letter color block
const Favicon: React.FC<FaviconProps> = ({ url, icon, title, className = '', letterClassName = '' }) => {
  const candidates = React.useMemo(() => {
    const list = [icon, ...(url ? getFaviconCandidates(url) : [])].filter(Boolean) as string[];
    return Array.from(new Set(list));
  }, [icon, url]);

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [icon, url]);

  const current = candidates[idx];

  if (!current) {
    return (
      <div className={`${className} ${letterClassName} ${colorFor(title)} text-white rounded-lg flex items-center justify-center font-bold uppercase shrink-0 overflow-hidden`}>
        {title.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={current}
      alt={title}
      className={`${className} object-contain shrink-0`}
      onError={() => setIdx(i => i + 1)}
      draggable={false}
    />
  );
};

export default Favicon;
