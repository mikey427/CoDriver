import { v4 as uuidv4 } from 'uuid';

export interface PendingPatch {
  id: string;
  createdAt: string;
  summary: string;
  path: string;
  content?: string;
  oldText?: string;
  newText?: string;
  aiTaskId?: string;
}

export class PatchStore {
  private pending?: PendingPatch;

  set(patch: Omit<PendingPatch, 'id' | 'createdAt'>): PendingPatch {
    this.pending = { ...patch, id: uuidv4(), createdAt: new Date().toISOString() };
    return this.pending;
  }

  get(): PendingPatch | undefined {
    return this.pending;
  }

  clear(): void {
    this.pending = undefined;
  }
}
