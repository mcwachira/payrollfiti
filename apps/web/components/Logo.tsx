export function Logo({
  className,
  color,
}: {
  className?: string;
  /** Overrides the badge fill — used to respect a tenant's custom brand color. */
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="PayrollFiti logo"
    >
      {/* badge */}
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="11"
        fill={color ?? 'var(--primary)'}
      />
      {/* payslip — fixed near-white so it stays legible against the colored
          badge in both light and dark mode (unlike var(--background), which
          is dark in dark mode and would nearly disappear here) */}
      <rect x="9.5" y="7.5" width="16" height="21" rx="2.5" fill="#fafafa" />
      <line
        x1="13"
        y1="13"
        x2="22"
        y2="13"
        stroke={color ?? 'var(--primary)'}
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.85"
      />
      <line
        x1="13"
        y1="17.5"
        x2="22"
        y2="17.5"
        stroke={color ?? 'var(--primary)'}
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.6"
      />
      <line
        x1="13"
        y1="22"
        x2="18.5"
        y2="22"
        stroke={color ?? 'var(--primary)'}
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.35"
      />
      {/* compliance checkmark badge — its ring matches the outer badge fill
          (not the page background) so the notch reads correctly regardless
          of light/dark mode or a tenant's custom brand color */}
      <circle
        cx="28"
        cy="27"
        r="7.5"
        fill="#22c55e"
        stroke={color ?? 'var(--primary)'}
        strokeWidth="2.5"
      />
      <path
        d="M24.8 27.1l2.1 2.1 4.3-4.4"
        stroke="white"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
