import type { AnnotationData, LegacyExport } from '@/types';

/**
 * The v1 "Export All Data" file, field for field. `data_range` uses the first
 * and last record in storage order, exactly like v1.
 */
export function toLegacyExport(data: AnnotationData, now: string): LegacyExport {
  const records = data.annotation_records;
  return {
    export_info: {
      export_date: now,
      total_images: data.total_images,
      total_annotations: data.total_annotations,
      data_range: {
        first_annotation: records[0]?.timestamp,
        last_annotation: records.at(-1)?.timestamp,
      },
    },
    annotation_records: records,
  };
}
