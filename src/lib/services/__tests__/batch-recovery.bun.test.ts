import { test, expect } from 'bun:test';
import { recoverBatch, type BatchCheckpoint } from '../batch-recovery';

test('resume uses the saved ID; completed results survive another restart without requests', async () => {
  const records = new Map<string, BatchCheckpoint>();
  const storage = { read: async (key:string) => structuredClone(records.get(key)), write: async (key:string, value:unknown) => {records.set(key, structuredClone(value) as BatchCheckpoint);} };
  const input = { content: {quest: 'Welcome'} };
  await expect(recoverBatch('session:0', input, async options => {
    expect(options.resumeJobId).toBeUndefined();
    await options.onSubmitted('batch-existing');
    throw new Error('Connection interrupted');
  }, storage)).rejects.toThrow('Connection interrupted');
  const results = [{content: {quest:'ようこそ'}}];
  expect(await recoverBatch('session:0', input, async options => {
    expect(options.resumeJobId).toBe('batch-existing'); return results;
  }, storage)).toEqual(results);
  expect(await recoverBatch('session:0', input, async () => {throw new Error('must not submit');}, storage)).toEqual(results);
  await expect(recoverBatch('session:0', {changed:true}, async () => results, storage)).rejects.toThrow('input changed');
});

test('unknown submission outcome blocks duplicate submission', async () => {
  let saved: BatchCheckpoint | undefined;
  const storage = { read: async () => saved, write: async (_key:string, value:unknown) => {saved=structuredClone(value) as BatchCheckpoint;} };
  await expect(recoverBatch('job', {}, async () => {throw new Error('lost response');}, storage)).rejects.toThrow('lost response');
  await expect(recoverBatch('job', {}, async () => {throw new Error('must not resubmit');}, storage)).rejects.toThrow('outcome is unknown');
});

test('failed durable save prevents submission', async () => {
  const storage = { read: async () => undefined, write: async () => {throw new Error('disk full');} };
  await expect(recoverBatch('job', {}, async () => {throw new Error('must not submit');}, storage)).rejects.toThrow('disk full');
});
