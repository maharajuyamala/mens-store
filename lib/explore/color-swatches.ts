/** Approximate fills for common catalog color names (lowercase keys). */
export const COLOR_SWATCH_HEX: Record<string, string> = {
  black: "#171717",
  "onyx black": "#0a0a0a",
  white: "#fafafa",
  "silk white": "#f5f5f4",
  gray: "#737373",
  grey: "#737373",
  "stone gray": "#78716c",
  blue: "#2563eb",
  "ocean blue": "#0369a1",
  green: "#16a34a",
  "forest green": "#14532d",
  red: "#dc2626",
  orange: "#ea580c",
  brown: "#78350f",
  beige: "#d6d3d1",
  tan: "#d4a574",
  navy: "#1e3a8a",
  purple: "#7c3aed",
  pink: "#db2777",
  yellow: "#ca8a04",
  gold: "#ca8a04",
  silver: "#a3a3a3",
};

export function swatchColor(name: string): string {
  const key = name.toLowerCase().trim();
  if (COLOR_SWATCH_HEX[key]) return COLOR_SWATCH_HEX[key];
  const first = key.split(/\s+/)[0];
  if (first && COLOR_SWATCH_HEX[first]) return COLOR_SWATCH_HEX[first];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h + key.charCodeAt(i) * (i + 1)) % 360;
  return `hsl(${h} 35% 45%)`;
}
