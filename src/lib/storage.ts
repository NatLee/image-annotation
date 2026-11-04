import { DEFAULT_ONLINE_SOURCE, type OnlineSourceId, STORAGE_KEYS } from '@/config';
import { normalizeClasses } from '@/lib/classes';
import { isOnlineSourceId } from '@/lib/online';
import { emptyData, readRecordList, summarize } from '@/lib/records';
import type { AnnotationData, LabelClass } from '@/types';

/**
 * Browser persistence. Keys are the v1 ones where v1 had them, so data saved
 * by the old app shows up here. Every access is guarded: private windows and
 * blocked storage must not break the app.
 */

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function browserStore(): KeyValueStore | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function readJson(store: KeyValueStore | undefined, key: string): unknown {
  try {
    const raw = store?.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function write(store: KeyValueStore | undefined, key: string, value: string | undefined): boolean {
  try {
    if (value === undefined) store?.removeItem(key);
    else store?.setItem(key, value);
    return !!store;
  } catch {
    return false;
  }
}

export function loadRecords(store: KeyValueStore | undefined, now: string): AnnotationData {
  const records = readRecordList(readJson(store, STORAGE_KEYS.records), now);
  return records ? summarize(records, now) : emptyData(now);
}

export const saveRecords = (store: KeyValueStore | undefined, data: AnnotationData) =>
  write(store, STORAGE_KEYS.records, JSON.stringify(data));

/** v1 "Clear All Data" removed the key rather than writing an empty value. */
export const clearRecords = (store: KeyValueStore | undefined) => write(store, STORAGE_KEYS.records, undefined);

export const loadClasses = (store: KeyValueStore | undefined): LabelClass[] =>
  normalizeClasses(readJson(store, STORAGE_KEYS.classes));

export const saveClasses = (store: KeyValueStore | undefined, classes: LabelClass[]) =>
  write(store, STORAGE_KEYS.classes, JSON.stringify(classes));

export function loadUserName(store: KeyValueStore | undefined): string {
  try {
    return store?.getItem(STORAGE_KEYS.userName) ?? '';
  } catch {
    return '';
  }
}

export const saveUserName = (store: KeyValueStore | undefined, name: string) =>
  write(store, STORAGE_KEYS.userName, name);

export function loadOnlineSource(store: KeyValueStore | undefined): OnlineSourceId {
  try {
    const value = store?.getItem(STORAGE_KEYS.onlineSource);
    return isOnlineSourceId(value) ? value : DEFAULT_ONLINE_SOURCE;
  } catch {
    return DEFAULT_ONLINE_SOURCE;
  }
}

export const saveOnlineSource = (store: KeyValueStore | undefined, id: OnlineSourceId) => write(store, STORAGE_KEYS.onlineSource, id);
