import type { TranslationResponse } from '../types/llm';

// IndexedDB transactions persist large batches without storing API credentials.
export async function recoveryRead<T>(key: string): Promise<T | undefined> {
  return recoveryTransaction<T>(key);
}
export async function recoveryWrite(key: string, value: unknown): Promise<void> {
  await recoveryTransaction(key, value);
}
export async function recoveryRemove(key: string): Promise<void> {
  await recoveryTransaction(key, undefined, true);
}
export async function recoveryClearSession(key: string, sessionId: string): Promise<void> {
  await recoveryTransaction(key, undefined, true, `${sessionId}:`);
}
async function recoveryTransaction<T>(key: string, value?: unknown, remove = false, prefix?: string): Promise<T | undefined> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('mml-batch-recovery', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', value !== undefined || remove ? 'readwrite' : 'readonly');
    const records = tx.objectStore('records');
    if (prefix) {
      const cursor = records.openCursor(IDBKeyRange.bound(prefix, prefix + '\uffff'));
      cursor.onsuccess = () => { if (cursor.result) { cursor.result.delete(); cursor.result.continue(); } };
    }
    const request = remove ? records.delete(key) : value !== undefined ? records.put(value, key) : records.get(key);
    tx.oncomplete = () => { db.close(); resolve(request.result as T); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || new Error('Could not save Batch recovery data')); };
  });
}
export interface BatchCheckpoint {
  digest: string;
  jobId?: string;
  responses?: TranslationResponse[];
}
export async function recoverBatch(
  key: string, input: unknown,
  run: (options: { resumeJobId?: string; onSubmitted: (id: string) => Promise<void> }) => Promise<TranslationResponse[]>,
  storage = { read: recoveryRead<BatchCheckpoint>, write: recoveryWrite }
): Promise<TranslationResponse[]> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(input)));
  const digest = Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
  let checkpoint = await storage.read(key);
  if (checkpoint && checkpoint.digest !== digest) throw new Error('Batch recovery input changed. Restore the original files and translation settings before resuming.');
  if (checkpoint?.responses) return checkpoint.responses;
  if (checkpoint && !checkpoint.jobId) throw new Error('Batch submission outcome is unknown. Check your provider dashboard before starting a new translation to avoid duplicate charges.');
  checkpoint ??= { digest };
  // Save before submission. A crash between submission and receipt of the ID must never cause automatic resubmission.
  await storage.write(key, checkpoint);
  const responses = await run({
    resumeJobId: checkpoint.jobId,
    onSubmitted: async id => { checkpoint!.jobId = id; await storage.write(key, checkpoint); }
  });
  checkpoint.responses = responses;
  await storage.write(key, checkpoint);
  return responses;
}
