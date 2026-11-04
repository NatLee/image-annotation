import { useEffect, useMemo, useReducer, useRef } from 'react';
import { browserStore, clearRecords, loadClasses, loadRecords, saveClasses, saveRecords } from '@/lib/storage';
import { SAMPLE_IMAGES } from '@/lib/sources';
import { createWorkspace, reducer } from '@/lib/workspace';

/**
 * The workspace reducer plus persistence: submitted records and classes are
 * written to the browser whenever they change. The list starts with the
 * bundled samples; nothing is open until the app has tried an online image.
 */
export function useWorkspace(onSaveError: () => void) {
  const store = useMemo(() => browserStore(), []);
  const [state, dispatch] = useReducer(reducer, null, () =>
    createWorkspace({
      images: [...SAMPLE_IMAGES],
      records: loadRecords(store, new Date().toISOString()),
      classes: loadClasses(store),
    }),
  );

  const saved = useRef({ records: state.records, classes: state.classes });

  useEffect(() => {
    if (state.records === saved.current.records) return;
    saved.current.records = state.records;
    // v1 removed the key when everything was cleared.
    const ok = state.records.annotation_records.length ? saveRecords(store, state.records) : clearRecords(store);
    if (!ok) onSaveError();
  }, [state.records, store, onSaveError]);

  useEffect(() => {
    if (state.classes === saved.current.classes) return;
    saved.current.classes = state.classes;
    if (!saveClasses(store, state.classes)) onSaveError();
  }, [state.classes, store, onSaveError]);

  return { state, dispatch, store };
}
