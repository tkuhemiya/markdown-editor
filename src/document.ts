
export interface Document {
  id?: number;
  name: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  lastOpened: Date;
}

export async function saveDocument(doc: Document): Promise<number> {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(["documents"], 'readwrite');
    const store = transaction.objectStore("documents");

    const request = store.put({
      ...doc,
      updatedAt: new Date(),
      lastOpened: doc.lastOpened || new Date(),
    });

    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function loadDocument(db: IDBDatabase, id: number): Promise<Document | null> {
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(["documents"], 'readonly');
    const store = transaction.objectStore("documents");
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

export async function deleteDocument(db: IDBDatabase, id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(["documents"], 'readwrite');
    const store = transaction.objectStore("documents");
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getLastOpenedDocument(db: IDBDatabase): Promise<Document | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['documents'], 'readonly');
    const store = tx.objectStore('documents');
    const index = store.index('lastOpened');

    // Highest lastOpened value first
    const request = index.openCursor(null, 'prev');

    request.onsuccess = () => {
      const cursor = request.result;
      resolve(cursor ? cursor.value : null);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function listDocuments(db: IDBDatabase): Promise<Document[]> {
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(["documents"], 'readonly');
    const store = transaction.objectStore("documents");
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
