import { StorageAdapter } from './StorageAdapter';

/**
 * IndexedDB implementation of storage adapter for offline-capable persistence
 */
export class IndexedDBAdapter implements StorageAdapter {
  private dbName: string = 'GardenCAD';
  private storeName: string = 'projects';
  private db: IDBDatabase | null = null;

  /**
   * Initialize IndexedDB connection
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'projectId' });
        }
      };
    });
  }

  /**
   * Save project data to IndexedDB
   */
  async save(projectId: string, data: any): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const record = {
        projectId,
        data,
        savedAt: new Date().toISOString()
      };

      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Load project data from IndexedDB
   */
  async load(projectId: string): Promise<any | null> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(projectId);

      request.onsuccess = () => {
        const record = request.result;
        resolve(record ? record.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * List all saved project IDs
   */
  async list(): Promise<string[]> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a project from IndexedDB
   */
  async delete(projectId: string): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(projectId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Check if a project exists in IndexedDB
   */
  async exists(projectId: string): Promise<boolean> {
    const data = await this.load(projectId);
    return data !== null;
  }
}
