import { indexedDB as fakeIndexedDB, IDBDatabase, IDBObjectStore, IDBIndex, IDBKeyRange, IDBCursor, IDBTransaction } from 'fake-indexeddb'

// jsdom has no IndexedDB; install the fake implementation globally BEFORE any
// test module imports Dexie (which checks for indexedDB at import time).
;(globalThis as unknown as { indexedDB: unknown }).indexedDB = fakeIndexedDB
;(globalThis as unknown as { IDBDatabase: unknown }).IDBDatabase = IDBDatabase
;(globalThis as unknown as { IDBObjectStore: unknown }).IDBObjectStore = IDBObjectStore
;(globalThis as unknown as { IDBIndex: unknown }).IDBIndex = IDBIndex
;(globalThis as unknown as { IDBKeyRange: unknown }).IDBKeyRange = IDBKeyRange
;(globalThis as unknown as { IDBCursor: unknown }).IDBCursor = IDBCursor
;(globalThis as unknown as { IDBTransaction: unknown }).IDBTransaction = IDBTransaction
