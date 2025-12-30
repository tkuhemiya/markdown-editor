
export interface Note {
  id?: number;
  name: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  lastOpened: Date;
}

export async function saveNote(db: IDBDatabase, doc: Note): Promise<number> {
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(["notes"], 'readwrite');
    const store = transaction.objectStore("notes");

    const request = store.put({
      ...doc,
      updatedAt: new Date(),
      lastOpened: doc.lastOpened || new Date(),
    });

    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function loadNote(db: IDBDatabase, id: number): Promise<Note | null> {
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(["notes"], 'readonly');
    const store = transaction.objectStore("notes");
    const request = store.get(id);

    request.onsuccess = () => {
      const doc = request.result;
      if (doc) {
        // Update lastOpened
        doc.lastOpened = new Date();
        saveNote(db, doc).then(() => resolve(doc)).catch(reject);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteNote(db: IDBDatabase, id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(["notes"], 'readwrite');
    const store = transaction.objectStore("notes");
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getLastOpenedNote(db: IDBDatabase): Promise<Note | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['notes'], 'readonly');
    const store = tx.objectStore('notes');
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

export async function listNotes(db: IDBDatabase): Promise<Note[]> {
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(["notes"], 'readonly');
    const store = transaction.objectStore("notes");
    const index = store.index('updatedAt');
    const request = index.openCursor(null, 'prev'); // Sort by updatedAt desc

    const results: Note[] = [];
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
