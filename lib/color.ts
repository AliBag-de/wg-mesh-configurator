const PALETTE = [
  "#f87171",
  "#fb923c",
  "#facc15",
  "#a3e635",
  "#34d399",
  "#22d3ee",
  "#60a5fa",
  "#818cf8",
  "#a78bfa",
  "#f472b6",
  "#fda4af",
  "#c084fc"
];

function hashString(value: string) {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return Math.abs(hash);
}

export function colorForKey(key: string) {
  const idx = hashString(key) % PALETTE.length;
  return PALETTE[idx];
}
