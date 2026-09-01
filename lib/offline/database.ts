"use client";

import type {
  CachedClient,
  CachedPayrollWorkEntry,
  CachedPayrollWorkspace,
  CachedWorker,
  CachedWorkerDeduction,
  CachedWorkpoint,
  CacheMetadata,
  CacheStoreName,
  PendingMutation,
} from "./types";

const databaseName = "RoyalForceOfflineDB";
const databaseVersion = 3;
const metadataStore = "metadata";

type CacheRecord =
  | CachedWorker
  | CachedClient
  | CachedWorkpoint
  | CachedPayrollWorkspace
  | CachedPayrollWorkEntry
  | CachedWorkerDeduction;

type StoreRecord = CacheRecord | PendingMutation | CacheMetadata;
type StoreName =
  | CacheStoreName
  | "metadata"
  | "payrollWorkEntries"
  | "payrollWorkspaces"
  | "pendingMutations"
  | "workerDeductions";

function openOfflineDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);

    request.onupgradeneeded = () => {
      const database = request.result;

      for (const storeName of ["workers", "clients", "workpoints"]) {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath: "id" });
        }
      }

      if (!database.objectStoreNames.contains("payrollWorkspaces")) {
        database.createObjectStore("payrollWorkspaces", { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains("payrollWorkEntries")) {
        database.createObjectStore("payrollWorkEntries", { keyPath: "entry_id" });
      }

      if (!database.objectStoreNames.contains("pendingMutations")) {
        database.createObjectStore("pendingMutations", { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains("workerDeductions")) {
        database.createObjectStore("workerDeductions", { keyPath: "deduction_id" });
      }

      if (!database.objectStoreNames.contains(metadataStore)) {
        database.createObjectStore(metadataStore, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<TValue>(request: IDBRequest<TValue>) {
  return new Promise<TValue>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function completeTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function replaceCachedRecords<TRecord extends CacheRecord>(
  storeName: CacheStoreName,
  records: TRecord[],
) {
  const database = await openOfflineDatabase();

  try {
    const transaction = database.transaction(
      [storeName, metadataStore],
      "readwrite",
    );
    const store = transaction.objectStore(storeName);
    const metadata = transaction.objectStore(metadataStore);

    store.clear();

    for (const record of records) {
      store.put(record);
    }

    metadata.put({
      count: records.length,
      id: storeName,
      updatedAt: new Date().toISOString(),
    } satisfies CacheMetadata);

    await completeTransaction(transaction);
  } finally {
    database.close();
  }
}

export async function replaceCachedRecordsWhere<TRecord extends CacheRecord>(
  storeName:
    | CacheStoreName
    | "payrollWorkEntries"
    | "payrollWorkspaces"
    | "workerDeductions",
  records: TRecord[],
  shouldReplaceExistingRecord: (record: TRecord) => boolean,
) {
  const database = await openOfflineDatabase();

  try {
    const transaction = database.transaction(
      [storeName, metadataStore],
      "readwrite",
    );
    const store = transaction.objectStore(storeName);
    const metadata = transaction.objectStore(metadataStore);
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = () => {
      for (const record of getAllRequest.result as TRecord[]) {
        if (shouldReplaceExistingRecord(record)) {
          const key =
            "entry_id" in record
              ? record.entry_id
              : "deduction_id" in record
                ? record.deduction_id
                : record.id;
          store.delete(key);
        }
      }

      for (const record of records) {
        store.put(record);
      }

      metadata.put({
        count: records.length,
        id: storeName,
        updatedAt: new Date().toISOString(),
      } satisfies CacheMetadata);
    };

    await completeTransaction(transaction);
  } finally {
    database.close();
  }
}

export async function getCachedRecords<TRecord extends CacheRecord>(
  storeName:
    | CacheStoreName
    | "payrollWorkEntries"
    | "payrollWorkspaces"
    | "workerDeductions",
) {
  const database = await openOfflineDatabase();

  try {
    return await new Promise<TRecord[]>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).getAll();

      request.onsuccess = () => resolve(request.result as TRecord[]);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export async function putOfflineRecord<TRecord extends StoreRecord>(
  storeName: StoreName,
  record: TRecord,
) {
  const database = await openOfflineDatabase();

  try {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(record);
    await completeTransaction(transaction);
  } finally {
    database.close();
  }
}

export async function deleteOfflineRecord(storeName: StoreName, key: IDBValidKey) {
  const database = await openOfflineDatabase();

  try {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(key);
    await completeTransaction(transaction);
  } finally {
    database.close();
  }
}

export async function getOfflineRecords<TRecord extends StoreRecord>(
  storeName: StoreName,
) {
  const database = await openOfflineDatabase();

  try {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();

    return (await requestToPromise(request)) as TRecord[];
  } finally {
    database.close();
  }
}

export async function getCacheMetadata(storeName: CacheStoreName) {
  const database = await openOfflineDatabase();

  try {
    return await new Promise<CacheMetadata | null>((resolve, reject) => {
      const transaction = database.transaction(metadataStore, "readonly");
      const request = transaction.objectStore(metadataStore).get(storeName);

      request.onsuccess = () =>
        resolve((request.result as CacheMetadata | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}
