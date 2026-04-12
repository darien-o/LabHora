export function MarujitaIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background circle */}
      <circle cx="256" cy="256" r="248" fill="#EEF2FF" stroke="#4F46E5" strokeWidth="16" />
      {/* Clock face */}
      <circle cx="256" cy="240" r="160" fill="white" stroke="#4F46E5" strokeWidth="12" />
      {/* Hour marks */}
      <line x1="256" y1="92" x2="256" y2="112" stroke="#4F46E5" strokeWidth="8" strokeLinecap="round" />
      <line x1="256" y1="368" x2="256" y2="388" stroke="#4F46E5" strokeWidth="8" strokeLinecap="round" />
      <line x1="108" y1="240" x2="128" y2="240" stroke="#4F46E5" strokeWidth="8" strokeLinecap="round" />
      <line x1="384" y1="240" x2="404" y2="240" stroke="#4F46E5" strokeWidth="8" strokeLinecap="round" />
      {/* Hour hand */}
      <line x1="256" y1="240" x2="256" y2="152" stroke="#1E1B4B" strokeWidth="10" strokeLinecap="round" />
      {/* Minute hand */}
      <line x1="256" y1="240" x2="320" y2="192" stroke="#4F46E5" strokeWidth="8" strokeLinecap="round" />
      {/* Center dot */}
      <circle cx="256" cy="240" r="10" fill="#4F46E5" />
      {/* Heart at bottom */}
      <path
        d="M256 440 C256 440 216 410 200 394 C180 374 180 348 200 332 C220 316 244 324 256 340 C268 324 292 316 312 332 C332 348 332 374 312 394 C296 410 256 440 256 440Z"
        fill="#E11D48"
        opacity="0.9"
      />
    </svg>
  );
}
