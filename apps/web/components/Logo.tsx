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
      aria-label="Logo"
    >
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="9"
        fill={color ?? 'var(--primary)'}
        stroke="var(--border)"
        strokeWidth="2.5"
      />
      {/* payslip */}
      <rect
        x="10.5"
        y="8.5"
        width="14"
        height="19"
        rx="2"
        fill="white"
        stroke="var(--border)"
        strokeWidth="2"
      />
      <line
        x1="13.5"
        y1="13.5"
        x2="21.5"
        y2="13.5"
        stroke="var(--border)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="13.5"
        y1="17.5"
        x2="21.5"
        y2="17.5"
        stroke="var(--border)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="13.5"
        y1="21.5"
        x2="18"
        y2="21.5"
        stroke="var(--border)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* coin accent */}
      <circle
        cx="27.5"
        cy="26.5"
        r="6.5"
        fill="#22c55e"
        stroke="var(--border)"
        strokeWidth="2"
      />
      <path
        d="M24.8 26.5h5.4M27.5 23.8v5.4"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
