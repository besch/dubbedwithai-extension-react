import { LogLevel, log } from "./utils";

export class AudioCache {
  private dbName = "AudioCache";
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private dbReady: Promise<void>;

  constructor() {
    this.dbReady = this.initIndexedDB();
  }

  private initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onerror = (event) => {
        log(LogLevel.ERROR, "IndexedDB error:", event);
        reject(new Error("Failed to open IndexedDB"));
      };
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        db.createObjectStore("audioFiles", { keyPath: "fileName" });
      };
    });
  }

  async getAudio(fileName: string): Promise<ArrayBuffer | null> {
    await this.dbReady;
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("IndexedDB not initialized"));
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
        reject(new Error("Failed to fetch audio from IndexedDB"));
      };
    });
  }

  async storeAudio(fileName: string, audioData: ArrayBuffer): Promise<void> {
    await this.dbReady;
    if (!this.db) throw new Error("IndexedDB not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["audioFiles"], "readwrite");
      const store = transaction.objectStore("audioFiles");
      const request = store.put({ fileName, audioData });

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error("Failed to store audio in IndexedDB"));
    });
  }
}
