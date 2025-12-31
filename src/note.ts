export interface Note {
  id?: number;
  name: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function saveNote(db: IDBDatabase, note: Note): Promise<number> {
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(["notes"], "readwrite");
    const store = transaction.objectStore("notes");

    const request = store.put({
      ...note,
      updatedAt: new Date(),
    });

    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function loadNote(
  db: IDBDatabase,
  id: number,
): Promise<Note | null> {
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(["notes"], "readonly");
    const store = transaction.objectStore("notes");
    const request = store.get(id);

    request.onsuccess = () => {
      const note = request.result as Note;
      resolve(note ?? null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteNote(db: IDBDatabase, id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(["notes"], "readwrite");
    const store = transaction.objectStore("notes");
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getLastUpdatedNote(
  db: IDBDatabase,
): Promise<Note | null> {
  return new Promise((resolve, reject) => {
    const tx = db!.transaction(["notes"], "readonly");
    const store = tx.objectStore("notes");
    const index = store.index("updatedAt");

    const request = index.openCursor(null, "prev");

    request.onsuccess = () => {
      const cursor = request.result;
      resolve(cursor ? cursor.value : null);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function listNotes(
  db: IDBDatabase,
  orderOf: "name" | "updatedAt" = "name",
): Promise<Note[]> {
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(["notes"], "readonly");
    const store = transaction.objectStore("notes");
    const index = store.index(orderOf);
    const request = index.openCursor(null, "prev");

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
