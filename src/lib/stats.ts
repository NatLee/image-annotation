import type { AnnotationSession } from '@/types';

export interface LeaderboardRow {
  name: string;
  images: number;
  boxes: number;
}

/** v1 "Rank": images annotated per person, most first. Boxes break ties. */
export function leaderboard(records: readonly AnnotationSession[]): LeaderboardRow[] {
  const rows = new Map<string, LeaderboardRow>();
  for (const record of records) {
    const name = record.annotator || 'Unknown';
    const row = rows.get(name) ?? { name, images: 0, boxes: 0 };
    row.images += 1;
    row.boxes += record.bounding_boxes.length;
    rows.set(name, row);
  }
  return [...rows.values()].sort((a, b) => b.images - a.images || b.boxes - a.boxes || a.name.localeCompare(b.name));
}
