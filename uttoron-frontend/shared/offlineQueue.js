/* Offline submission queue — IndexedDB-backed.

   If a submit call fails because the device has no connection (not because
   the server rejected the data), the payload is stored here instead of
   being lost, and is retried automatically the next time the browser
   reports it's back online — or on page load, in case connectivity came
   back while the tab was closed.

   Deliberately generic across submission "kinds" (keyed by a string, e.g.
   'typing-result') so more than one track can share this one queue +
   flush loop instead of each building its own. Load this before any file
   that calls enqueue()/autoFlush(). */
(function (global) {
    "use strict";

    const DB_NAME = 'uttoron-offline-queue';
    const DB_VERSION = 1;
    const STORE_NAME = 'pending';

    function openDb() {
        return new Promise((resolve, reject) => {
            if (!global.indexedDB) { reject(new Error('IndexedDB not available in this browser.')); return; }
            const req = global.indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function enqueue(kind, payload) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).add({ kind, payload, queuedAt: Date.now() });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function getAll() {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function remove(id) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function count() {
        return (await getAll()).length;
    }

    // `handlers` maps kind -> async function(payload) that performs the real
    // submission (should throw the same { isNetworkError: true } shaped
    // error as shared/backendBridge.js's apiFetch when offline). Stops at
    // the first item that still fails with a network error — no point
    // hammering the rest while the device is still offline, it'll pick up
    // where it left off on the next flush. An item the server rejects
    // outright (not a network error) is dropped, since retrying it again
    // later could never succeed either.
    let flushing = false;
    async function flush(handlers, onChange) {
        if (flushing) return;
        flushing = true;
        try {
            const items = await getAll();
            for (const item of items) {
                const handler = handlers[item.kind];
                if (!handler) continue;
                try {
                    await handler(item.payload);
                    await remove(item.id);
                    if (onChange) onChange(await count());
                } catch (err) {
                    if (err && err.isNetworkError) break;
                    console.error('Dropping a queued offline submission the server rejected:', item, err);
                    await remove(item.id);
                    if (onChange) onChange(await count());
                }
            }
        } finally {
            flushing = false;
        }
    }

    function autoFlush(handlers, onChange) {
        flush(handlers, onChange);
        global.addEventListener('online', () => flush(handlers, onChange));
    }

    global.OfflineQueue = { enqueue, getAll, remove, count, flush, autoFlush };
})(window);
