/**
 * @file history.ts
 * @description إدارة التراجع والإعادة بنمط الأوامر (Command Pattern).
 * يتم حفظ التغييرات الجزئية فقط (Before / After أو Add / Delete) بدلاً من استنساخ المشروع بالكامل.
 */

import { Command } from './types.ts';

export type HistoryChangeListener = (canUndo: boolean, canRedo: boolean) => void;

export class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistorySize: number = 100;
  private listeners: Set<HistoryChangeListener> = new Set();

  constructor(maxHistorySize: number = 100) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * تسجيل أمر جديد في مكدس التراجع ومسح مكدس الإعادة
   */
  public push(command: Command): void {
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
    // مسح الإعادة عند تنفيذ إجراء جديد
    this.redoStack = [];
    this.notify();
  }

  /**
   * استخراج آخر أمر للتراجع عنه
   */
  public popUndo(): Command | undefined {
    const cmd = this.undoStack.pop();
    if (cmd) {
      this.redoStack.push(cmd);
      this.notify();
    }
    return cmd;
  }

  /**
   * استخراج آخر أمر لإعادة تطبيقه
   */
  public popRedo(): Command | undefined {
    const cmd = this.redoStack.pop();
    if (cmd) {
      this.undoStack.push(cmd);
      this.notify();
    }
    return cmd;
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
    this.notify();
  }

  public subscribe(listener: HistoryChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.canUndo(), this.canRedo());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const cu = this.canUndo();
    const cr = this.canRedo();
    this.listeners.forEach((listener) => listener(cu, cr));
  }
}
