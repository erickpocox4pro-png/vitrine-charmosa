import type { Product } from "@/data/products";

/**
 * Sorts products by grouping similar background colors together.
 * Products with the same bg_color_group appear in sequence for visual harmony.
 * Only groups if there are enough products (2+) with the same background.
 * Products without classification go at the end.
 */
export function sortProductsByBackground(products: Product[]): Product[] {
  if (!products || products.length === 0) return [];

  // Group products by bg_color_group
  const groups: Record<string, Product[]> = {};
  const ungrouped: Product[] = [];

  for (const p of products) {
    const group = p.bg_color_group;
    if (group) {
      if (!groups[group]) groups[group] = [];
      groups[group].push(p);
    } else {
      ungrouped.push(p);
    }
  }

  // Sort group keys by size (largest first) for best visual impact
  const sortedGroupKeys = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);

  // Check if grouping makes sense (at least one group with 2+ items)
  const hasValidGroups = sortedGroupKeys.some(key => groups[key].length >= 2);

  if (!hasValidGroups) {
    // Not enough similar backgrounds to group meaningfully
    return products;
  }

  // Build sorted array: groups with 2+ items in sequence, then singles + ungrouped
  const sorted: Product[] = [];
  const singles: Product[] = [];

  for (const key of sortedGroupKeys) {
    if (groups[key].length >= 2) {
      sorted.push(...groups[key]);
    } else {
      singles.push(...groups[key]);
    }
  }

  sorted.push(...singles, ...ungrouped);

  return sorted;
}
