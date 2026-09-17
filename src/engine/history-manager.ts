/**
 * @file    src/engine/history-manager.ts
 * @version 1.0.0
 * @description
 *   Lightweight command history manager supporting Undo/Redo for canvas topology.
 *   Provides atomic snapshot capture with structural cloning and bounded memory depth (default 25).
 */

import type { WorkflowNode, WorkflowEdge } from './types.ts';

export interface GraphSnapshot {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export class HistoryManager {
  private undoStack: GraphSnapshot[] = [];
  private redoStack: GraphSnapshot[] = [];
  private maxDepth: number;

  constructor(maxDepth = 25) {
    this.maxDepth = maxDepth;
  }

  /**
   * Pushes a new snapshot of the canvas graph onto the undo stack.
   * Clears the redo stack on any new user action.
   */
  public pushSnapshot(snapshot: GraphSnapshot): void {
    const cloned: GraphSnapshot =
      typeof structuredClone === 'function'
        ? structuredClone(snapshot)
        : JSON.parse(JSON.stringify(snapshot));

    this.undoStack.push(cloned);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  /**
   * Undoes the last action and returns the previous state, or null if stack is empty.
   * Pushes the current state onto the redo stack.
   */
  public undo(currentSnapshot: GraphSnapshot): GraphSnapshot | null {
    if (this.undoStack.length === 0) return null;

    const previous = this.undoStack.pop()!;
    const currentCloned: GraphSnapshot =
      typeof structuredClone === 'function'
        ? structuredClone(currentSnapshot)
        : JSON.parse(JSON.stringify(currentSnapshot));

    this.redoStack.push(currentCloned);
    return previous;
  }

  /**
   * Redoes the previously undone action, or null if redo stack is empty.
   * Pushes the current state onto the undo stack.
   */
  public redo(currentSnapshot: GraphSnapshot): GraphSnapshot | null {
    if (this.redoStack.length === 0) return null;

    const next = this.redoStack.pop()!;
    const currentCloned: GraphSnapshot =
      typeof structuredClone === 'function'
        ? structuredClone(currentSnapshot)
        : JSON.parse(JSON.stringify(currentSnapshot));

    this.undoStack.push(currentCloned);
    return next;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  public getDepth(): { undo: number; redo: number } {
    return { undo: this.undoStack.length, redo: this.redoStack.length };
  }

  public getUndoDepth(): number {
    return this.undoStack.length;
  }

  public getRedoDepth(): number {
    return this.redoStack.length;
  }
}
