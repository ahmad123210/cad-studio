/**
 * @file storage.ts
 * @description تخزين المشاريع في IndexedDB بدلاً من الاعتماد الكامل على localStorage:
 * - لا يوجد حد 5MB (المشاريع الكبيرة وصور الخلفية تُحفظ بأمان)
 * - نسخ احتياطية تلقائية متعددة لكل مشروع (آخر 10 نسخ) قابلة للاستعادة
 * كل الدوال غير متزامنة وترمي خطأً إن لم يكن IndexedDB متاحاً، فيعود المستدعي إلى localStorage.
 */

import type { ProjectData } from './types.ts';

const DB_NAME = 'cad-studio-db';
const DB_VERSION = 1;
const PROJECTS = 'projects';
const BACKUPS = 'backups';
export const MAX_BACKUPS_PER_PROJECT = 10;

export interface StoredProject {
  id: string;
  savedAt: string;
  data: ProjectData;
}

export interface BackupEntry {
  key: number;
  projectId: string;
  savedAt: string;
  name: string;
  objectCount: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB غير متاح'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(BACKUPS)) {
          const s = db.createObjectStore(BACKUPS, { keyPath: 'key', autoIncrement: true });
          s.createIndex('projectId', 'projectId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        let value: T | undefined;
        if (req) req.onsuccess = () => (value = req.result);
        t.oncomplete = () => resolve(value);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export async function idbSaveProject(id: string, data: ProjectData): Promise<void> {
  const rec: StoredProject = { id, savedAt: data.savedAt || new Date().toISOString(), data };
  await tx(PROJECTS, 'readwrite', (s) => s.put(rec));
}

export async function idbLoadProject(id: string): Promise<StoredProject | null> {
  const rec = await tx<StoredProject>(PROJECTS, 'readonly', (s) => s.get(id));
  return rec ?? null;
}

export async function idbListProjects(): Promise<{ id: string; name: string; savedAt: string }[]> {
  const all = (await tx<StoredProject[]>(PROJECTS, 'readonly', (s) => s.getAll())) || [];
  return all.map((r) => ({ id: r.id, name: r.data?.project?.name || r.id, savedAt: r.savedAt }));
}

export async function idbAddBackup(projectId: string, data: ProjectData): Promise<void> {
  const objectCount = (data.sheets || []).reduce((n, s) => n + (s.objects?.length || 0), 0) || data.objects.length;
  await tx(BACKUPS, 'readwrite', (s) =>
    s.add({ projectId, savedAt: data.savedAt || new Date().toISOString(), name: data.project?.name || projectId, objectCount, data })
  );
  // تقليم: الإبقاء على أحدث MAX_BACKUPS_PER_PROJECT
  const list = await idbListBackups(projectId);
  const extra = list.slice(MAX_BACKUPS_PER_PROJECT);
  if (extra.length) {
    await tx(BACKUPS, 'readwrite', (s) => {
      for (const b of extra) s.delete(b.key);
    });
  }
}

export async function idbListBackups(projectId: string): Promise<BackupEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(BACKUPS, 'readonly');
    const req = t.objectStore(BACKUPS).index('projectId').openCursor(IDBKeyRange.only(projectId));
    const out: BackupEntry[] = [];
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) {
        const v = cur.value as BackupEntry & { data: unknown };
        out.push({ key: v.key, projectId: v.projectId, savedAt: v.savedAt, name: v.name, objectCount: v.objectCount });
        cur.continue();
      }
    };
    t.oncomplete = () => resolve(out.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1)));
    t.onerror = () => reject(t.error);
  });
}

export async function idbGetBackup(key: number): Promise<ProjectData | null> {
  const rec = await tx<{ data: ProjectData }>(BACKUPS, 'readonly', (s) => s.get(key));
  return rec?.data ?? null;
}
