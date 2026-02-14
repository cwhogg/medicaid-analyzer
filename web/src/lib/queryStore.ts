export interface StoredQuery {
  id: string;
  question: string;
  sql: string;
  chartType: "table" | "line" | "bar" | "pie";
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  timestamp: number;
}

export interface StoredAnalysisStep {
  stepIndex: number;
  title: string;
  sql: string | null;
  chartType: string;
  columns: string[];
  rows: unknown[][];
  insight: string | null;
  error: string | null;
}

export interface StoredAnalysis {
  id: string;
  question: string;
  plan: string[];
  steps: StoredAnalysisStep[];
  summary: string | null;
  stepCount: number;
  timestamp: number;
}

const DB_NAME = "medicaid-analyzer";
const DB_VERSION = 2;
const QUERIES_STORE = "queries";
const ANALYSES_STORE = "analyses";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        const store = db.createObjectStore(QUERIES_STORE, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
      if (oldVersion < 2) {
        const store = db.createObjectStore(ANALYSES_STORE, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

// --- Queries ---

export async function saveQuery(query: StoredQuery): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUERIES_STORE, "readwrite");
    tx.objectStore(QUERIES_STORE).put(query);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllQueries(): Promise<StoredQuery[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUERIES_STORE, "readonly");
    const store = tx.objectStore(QUERIES_STORE);
    const index = store.index("timestamp");
    const request = index.openCursor(null, "prev"); // reverse chronological
    const results: StoredQuery[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        results.push(cursor.value as StoredQuery);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getQuery(id: string): Promise<StoredQuery | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUERIES_STORE, "readonly");
    const request = tx.objectStore(QUERIES_STORE).get(id);
    request.onsuccess = () => resolve(request.result as StoredQuery | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteQuery(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUERIES_STORE, "readwrite");
    tx.objectStore(QUERIES_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Analyses ---

export async function saveAnalysis(analysis: StoredAnalysis): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ANALYSES_STORE, "readwrite");
    tx.objectStore(ANALYSES_STORE).put(analysis);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllAnalyses(): Promise<StoredAnalysis[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ANALYSES_STORE, "readonly");
    const store = tx.objectStore(ANALYSES_STORE);
    const index = store.index("timestamp");
    const request = index.openCursor(null, "prev");
    const results: StoredAnalysis[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        results.push(cursor.value as StoredAnalysis);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteAnalysis(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ANALYSES_STORE, "readwrite");
    tx.objectStore(ANALYSES_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
