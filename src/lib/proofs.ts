/**
 * Payment proof screenshots: a picture the customer sent (for example a
 * JazzCash or Easypaisa confirmation) attached to one payment. The image is
 * copied into the app's private documents folder and the file name is kept in
 * the local-only `payment_proofs` table, so proofs are never synced or written
 * into backups. They go away with the payment, the customer, the business or
 * "Delete all data".
 */
import { randomUUID } from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { clearPaymentProof, deletePayment, listProofFiles, setPaymentProof } from '../db/repo';
import { deleteCacheCopy } from './exportFiles';

/** Screenshots are small; anything bigger is not one. */
export const MAX_PROOF_BYTES = 15 * 1024 * 1024;

const proofDir = () => new Directory(Paths.document, 'proofs');

/** Where a stored proof lives, for <Image>. */
export function proofUri(file: string): string {
  return new File(proofDir(), file).uri;
}

export class ProofError extends Error {
  constructor(public kind: 'tooLarge' | 'unreadable') {
    super(kind);
  }
}

/** Let the user pick an image; null when they cancel. The copy is in the cache until attached. */
export async function pickProofImage(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['image/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  if ((asset.size ?? 0) > MAX_PROOF_BYTES) {
    deleteCacheCopy(asset.uri);
    throw new ProofError('tooLarge');
  }
  return asset.uri;
}

function extensionOf(uri: string): string {
  const m = /\.(png|jpe?g|webp|gif|heic|heif)$/i.exec(uri.split('?')[0]);
  return m ? m[1].toLowerCase() : 'jpg';
}

function tryDelete(file: File) {
  try {
    if (file.exists) file.delete();
  } catch {
    // Already gone.
  }
}

/** Copy a picked image into the proofs folder and link it to the payment (replacing any earlier one). */
export async function attachProof(db: SQLiteDatabase, paymentId: string, pickedUri: string): Promise<void> {
  const source = new File(pickedUri);
  if (!source.exists) throw new ProofError('unreadable');
  if ((source.size ?? 0) > MAX_PROOF_BYTES) {
    deleteCacheCopy(pickedUri);
    throw new ProofError('tooLarge');
  }
  const dir = proofDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `${randomUUID()}.${extensionOf(pickedUri)}`);
  source.copy(dest);
  try {
    const previous = await setPaymentProof(db, paymentId, dest.name);
    if (previous && previous !== dest.name) tryDelete(new File(dir, previous));
  } catch (e) {
    tryDelete(dest);
    throw e;
  } finally {
    deleteCacheCopy(pickedUri);
  }
}

/** Remove the proof from a payment and delete its file. */
export async function removeProof(db: SQLiteDatabase, paymentId: string): Promise<void> {
  const previous = await clearPaymentProof(db, paymentId);
  if (previous) tryDelete(new File(proofDir(), previous));
}

/** Delete a payment together with its proof file. */
export async function deletePaymentWithProof(db: SQLiteDatabase, paymentId: string): Promise<void> {
  const previous = await clearPaymentProof(db, paymentId);
  await deletePayment(db, paymentId);
  if (previous) tryDelete(new File(proofDir(), previous));
}

/** Delete proof files that no payment refers to any more (after deleting customers or businesses). */
export async function pruneProofs(db: SQLiteDatabase): Promise<void> {
  const dir = proofDir();
  try {
    if (!dir.exists) return;
    const keep = new Set(await listProofFiles(db));
    for (const entry of dir.list()) {
      if (entry instanceof File && !keep.has(entry.name)) tryDelete(entry);
    }
  } catch {
    // Folder unreadable: nothing to clean.
  }
}

/** "Delete all data": remove every proof file. */
export function clearAllProofs(): void {
  try {
    const dir = proofDir();
    if (dir.exists) dir.delete();
  } catch {
    // Already gone.
  }
}
