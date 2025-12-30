export function debounce(fn: Function, delay = 1000) {
  let timer: number;

  return function (...args: any) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn(args)
    }, delay)
  }
}

export async function compressText(text: string): Promise<string> {
  return text;
}

export async function decompressText(text: string): Promise<string> {
  return text;
}

// IndexedDB functions
const DB_NAME = 'MarkdownEditorDB';
const DB_VERSION = 1;
const DOCS_STORE = 'documents';

export interface Document {
  id?: number;
  name: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  lastOpened: Date;
}

let db: IDBDatabase | null = null;

export async function initDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        const store = db.createObjectStore(DOCS_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('lastOpened', 'lastOpened', { unique: false });
      }
    };
  });
}

export async function saveDocument(doc: Document): Promise<number> {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([DOCS_STORE], 'readwrite');
    const store = transaction.objectStore(DOCS_STORE);

    const request = store.put({
      ...doc,
      updatedAt: new Date(),
      lastOpened: doc.lastOpened || new Date(),
    });

    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function loadDocument(id: number): Promise<Document | null> {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([DOCS_STORE], 'readonly');
    const store = transaction.objectStore(DOCS_STORE);
    const request = store.get(id);

    request.onsuccess = () => {
      const doc = request.result;
      if (doc) {
        // Update lastOpened
        doc.lastOpened = new Date();
        saveDocument(doc).then(() => resolve(doc)).catch(reject);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function listDocuments(): Promise<Document[]> {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([DOCS_STORE], 'readonly');
    const store = transaction.objectStore(DOCS_STORE);
    const index = store.index('updatedAt');
    const request = index.openCursor(null, 'prev'); // Sort by updatedAt desc

    const results: Document[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteDocument(id: number): Promise<void> {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([DOCS_STORE], 'readwrite');
    const store = transaction.objectStore(DOCS_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getLastOpenedDocument(): Promise<Document | null> {
  const docs = await listDocuments();
  return docs.find(doc => doc.lastOpened) || docs[0] || null;
}
