export default function Sparkline({
  points,
  width = 96,
  height = 28,
}: {
  points: number[];
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const d = points
    .map((p, i) => {
      const x = (i * step).toFixed(1);
      const y = (height - 3 - ((p - min) / span) * (height - 6)).toFixed(1);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
  const up = points[points.length - 1] >= points[0];
  const stroke = up ? "#34d399" : "#fb7185";
  return (
    <svg
      width={width}
      height={height}
      className="inline-block"
      role="img"
      aria-label={`trend: ${up ? "up" : "down"}`}
    >
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.8} />
    </svg>
  );
}
