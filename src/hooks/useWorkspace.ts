import { useEffect, useMemo, useReducer, useRef } from 'react';
import { browserStore, clearRecords, loadClasses, loadRecords, saveClasses, saveRecords } from '@/lib/storage';
import { SAMPLE_IMAGES } from '@/lib/sources';
import { createWorkspace, nextPendingKey, reducer } from '@/lib/workspace';

/**
 * The workspace reducer plus persistence: submitted records and classes are
 * written to the browser whenever they change. Everything starts with the
 * sample set, opened at the first image that still needs work.
 */
export function useWorkspace(onSaveError: () => void) {
  const store = useMemo(() => browserStore(), []);
  const [state, dispatch] = useReducer(reducer, null, () => {
    const initial = createWorkspace({
      images: [...SAMPLE_IMAGES],
      records: loadRecords(store, new Date().toISOString()),
      classes: loadClasses(store),
    });
    const first = nextPendingKey(initial);
    return first ? reducer(initial, { type: 'image/open', key: first }) : initial;
  });

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
