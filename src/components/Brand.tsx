export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--color-brand)" />
      <g transform="rotate(45 32 32)">
        <path d="M32 9c10 7 13 16 13 23s-3 16-13 23c-10-7-13-16-13-23S22 16 32 9z" fill="#fbf8f3" />
        <path d="M32 17v40" stroke="var(--color-brand)" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}
