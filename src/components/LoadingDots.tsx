'use client';

interface Props {
  size?: 'sm' | 'md';
}

/** The 3-dot bounce indicator reused across every loading state in the app. */
export default function LoadingDots({ size = 'md' }: Props) {
  const dotClass = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';
  const gapClass = size === 'sm' ? 'gap-1' : 'gap-1.5';

  return (
    <div className={`flex ${gapClass}`}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`${dotClass} rounded-full bg-blue-500 animate-bounce`}
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}
