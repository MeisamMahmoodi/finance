// Halbkreis-Fortschrittsanzeige (180°), wie im Referenz-Design.
export function Gauge({ percent, size = 220 }: { percent: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const strokeWidth = 14;
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // Halbkreis von 180° (links) bis 0° (rechts), oben.
  const circumference = Math.PI * r;
  const dash = (clamped / 100) * circumference;

  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <svg width={size} height={size / 2 + strokeWidth / 2} viewBox={`0 0 ${size} ${size / 2 + strokeWidth / 2}`}>
      <path
        d={arcPath}
        fill="none"
        stroke="#232326"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d={arcPath}
        fill="none"
        stroke="#8b8bff"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
      />
    </svg>
  );
}
