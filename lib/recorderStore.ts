// Penyimpanan sementara audio "Rekam Akurat" di IndexedDB (di perangkat), agar rekaman yang
// terputus (telepon masuk, aplikasi ditutup paksa, baterai habis) masih bisa dipulihkan.

const DB_NAME = 'smartnotes-recorder';
const CHUNKS = 'chunks';
const META = 'meta';

interface SessionMeta {
  mime: string;
  startedAt: number;
}

export interface RecoveredSession {
  file: File;
  startedAt: number;
  size: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB tidak tersedia'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CHUNKS)) db.createObjectStore(CHUNKS, { autoIncrement: true });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

const extensionFor = (mime: string) => (mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm');

/** Mulai sesi baru: hapus sisa sesi lama lalu catat metadata. */
export async function startSession(mime: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction([CHUNKS, META], 'readwrite');
    tx.objectStore(CHUNKS).clear();
    tx.objectStore(META).clear();
    tx.objectStore(META).put({ mime, startedAt: Date.now() } as SessionMeta, 'session');
    await done(tx);
    db.close();
  } catch (e) {
    console.warn('Penyimpanan rekaman tidak tersedia:', e);
  }
}

export async function appendChunk(blob: Blob): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(CHUNKS, 'readwrite');
    tx.objectStore(CHUNKS).add(blob);
    await done(tx);
    db.close();
  } catch (e) {
    // Gagal menyimpan satu potongan tidak boleh menghentikan rekaman
  }
}

/** Ambil rekaman yang belum selesai diproses (bila ada). */
export async function loadSession(): Promise<RecoveredSession | null> {
  try {
    const db = await openDb();
    const tx = db.transaction([CHUNKS, META], 'readonly');
    const chunksReq = tx.objectStore(CHUNKS).getAll();
    const metaReq = tx.objectStore(META).get('session');
    await done(tx);
    db.close();
    const chunks = (chunksReq.result || []) as Blob[];
    const meta = metaReq.result as SessionMeta | undefined;
    if (!meta || chunks.length === 0) return null;
    const blob = new Blob(chunks, { type: meta.mime });
    if (blob.size < 2000) return null;
    const file = new File([blob], `rekaman-pulih-${meta.startedAt}.${extensionFor(meta.mime)}`, { type: meta.mime });
    return { file, startedAt: meta.startedAt, size: blob.size };
  } catch (e) {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction([CHUNKS, META], 'readwrite');
    tx.objectStore(CHUNKS).clear();
    tx.objectStore(META).clear();
    await done(tx);
    db.close();
  } catch (e) {
    // abaikan
  }
}
