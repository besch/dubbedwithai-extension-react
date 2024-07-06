import { LogLevel } from "./utils";
import { log } from "./utils";

export class AudioCache {
  private dbName = "AudioCache";
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  constructor() {
    this.initIndexedDB();
  }

  private initIndexedDB(): void {
    const request = indexedDB.open(this.dbName, this.dbVersion);
    request.onerror = (event) => log(LogLevel.ERROR, "IndexedDB error:", event);
    request.onsuccess = (event) =>
      (this.db = (event.target as IDBOpenDBRequest).result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      db.createObjectStore("audioFiles", { keyPath: "fileName" });
    };
  }

  async getAudio(fileName: string): Promise<ArrayBuffer | null> {
    return new Promise((resolve) => {
      if (!this.db) {
        resolve(null);
        return;
      }

      const transaction = this.db.transaction(["audioFiles"], "readonly");
      const store = transaction.objectStore("audioFiles");
      const request = store.get(fileName);

      request.onsuccess = () =>
        resolve(request.result ? request.result.audioData : null);
      request.onerror = () => {
        log(
          LogLevel.ERROR,
          "Error fetching audio from IndexedDB:",
          request.error
        );
        resolve(null);
      };
    });
  }

  async storeAudio(fileName: string, audioData: ArrayBuffer): Promise<void> {
    if (!this.db) throw new Error("IndexedDB not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["audioFiles"], "readwrite");
      const store = transaction.objectStore("audioFiles");
      const request = store.put({ fileName, audioData });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
