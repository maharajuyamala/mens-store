/** Color swatches for quick “Add product” dialog: value stored on product `color`. */
export type ColorSwatch = {
  value: string;
  label: string;
  hex: string;
};

export const QUICK_ADD_COLOR_SWATCHES: ColorSwatch[] = [
  { value: "pearl-white", label: "Pearl White", hex: "#F5F5F0" },
  { value: "ivory", label: "Ivory", hex: "#FFFFF0" },
  { value: "cream", label: "Cream", hex: "#FFFDD0" },
  { value: "snow-white", label: "Snow White", hex: "#FFFAFA" },
  { value: "off-white", label: "Off White", hex: "#FAF0E6" },
  { value: "light-gray", label: "Light Gray", hex: "#D3D3D3" },
  { value: "silver", label: "Silver", hex: "#C0C0C0" },
  { value: "slate-gray", label: "Slate Gray", hex: "#708090" },
  { value: "charcoal", label: "Charcoal", hex: "#36454F" },
  { value: "graphite", label: "Graphite", hex: "#41424C" },
  { value: "black", label: "Black", hex: "#0D0D0D" },
  { value: "jet-black", label: "Jet Black", hex: "#050505" },
  { value: "navy", label: "Navy", hex: "#001F3F" },
  { value: "midnight-blue", label: "Midnight Blue", hex: "#191970" },
  { value: "royal-blue", label: "Royal Blue", hex: "#4169E1" },
  { value: "cobalt-blue", label: "Cobalt Blue", hex: "#0047AB" },
  { value: "sky-blue", label: "Sky Blue", hex: "#87CEEB" },
  { value: "baby-blue", label: "Baby Blue", hex: "#89CFF0" },
  { value: "powder-blue", label: "Powder Blue", hex: "#B0E0E6" },
  { value: "teal", label: "Teal", hex: "#008080" },
  { value: "turquoise", label: "Turquoise", hex: "#40E0D0" },
  { value: "denim-blue", label: "Denim Blue", hex: "#1560BD" },
  { value: "crimson", label: "Crimson", hex: "#DC143C" },
  { value: "cherry-red", label: "Cherry Red", hex: "#DE3163" },
  { value: "burgundy", label: "Burgundy", hex: "#800020" },
  { value: "wine", label: "Wine", hex: "#722F37" },
  { value: "maroon", label: "Maroon", hex: "#800000" },
  { value: "coral", label: "Coral", hex: "#FF7F50" },
  { value: "rust", label: "Rust", hex: "#B7410E" },
  { value: "orange", label: "Orange", hex: "#FF9800" },
  { value: "peach", label: "Peach", hex: "#FFCBA4" },
  { value: "apricot", label: "Apricot", hex: "#FBCEB1" },
  { value: "gold", label: "Gold", hex: "#FFD700" },
  { value: "mustard", label: "Mustard", hex: "#FFDB58" },
  { value: "lemon", label: "Lemon", hex: "#FFF44F" },
  { value: "olive", label: "Olive", hex: "#808000" },
  { value: "sage", label: "Sage", hex: "#9CAB86" },
  { value: "mint", label: "Mint", hex: "#98FF98" },
  { value: "emerald", label: "Emerald", hex: "#50C878" },
  { value: "forest-green", label: "Forest Green", hex: "#228B22" },
  { value: "hunter-green", label: "Hunter Green", hex: "#355E3B" },
  { value: "lime", label: "Lime", hex: "#32CD32" },
  { value: "seafoam", label: "Seafoam", hex: "#93E9BE" },
  { value: "lavender", label: "Lavender", hex: "#E6E6FA" },
  { value: "lilac", label: "Lilac", hex: "#C8A2C8" },
  { value: "plum", label: "Plum", hex: "#8E4585" },
  { value: "violet", label: "Violet", hex: "#EE82EE" },
  { value: "purple", label: "Purple", hex: "#6A0DAD" },
  { value: "mauve", label: "Mauve", hex: "#E0B0FF" },
  { value: "eggplant", label: "Eggplant", hex: "#614051" },
  { value: "pink", label: "Pink", hex: "#FFC0CB" },
  { value: "blush", label: "Blush", hex: "#DE5D83" },
  { value: "hot-pink", label: "Hot Pink", hex: "#FF69B4" },
  { value: "rose-gold", label: "Rose Gold", hex: "#B76E79" },
  { value: "tan", label: "Tan", hex: "#D2B48C" },
  { value: "beige", label: "Beige", hex: "#F5F5DC" },
  { value: "khaki", label: "Khaki", hex: "#C3B091" },
  { value: "camel", label: "Camel", hex: "#C19A6B" },
  { value: "chocolate", label: "Chocolate", hex: "#7B3F00" },
  { value: "espresso", label: "Espresso", hex: "#3C2415" },
  { value: "taupe", label: "Taupe", hex: "#483C32" },
  { value: "nude", label: "Nude", hex: "#E3BC9A" },
  { value: "stone", label: "Stone", hex: "#928E85" },
  { value: "brown", label: "Brown", hex: "#795548" },
  { value: "copper", label: "Copper", hex: "#B87333" },
  { value: "bronze", label: "Bronze", hex: "#CD7F32" },
  { value: "multi-print", label: "Multi / print", hex: "#E0E0E0" },
];

export type AudienceId = "men" | "women" | "kids";

export const QUICK_ADD_AUDIENCES: { id: AudienceId; label: string }[] = [
  { id: "men", label: "Men" },
  { id: "women", label: "Women" },
  { id: "kids", label: "Kids" },
];

/** Shown after an audience is selected (same set for Men / Women / Kids). */
export const QUICK_ADD_STYLE_TAGS: { id: string; label: string }[] = [
  { id: "sports", label: "Sports" },
  { id: "casual", label: "Casual" },
  { id: "formal", label: "Formal" },
  { id: "pants", label: "Pants" },
  { id: "shirts", label: "Shirts" },
  { id: "undergarments", label: "Undergarments" },
];

export function colorSwatchByValue(value: string): ColorSwatch | undefined {
  return QUICK_ADD_COLOR_SWATCHES.find((c) => c.value === value);
}
