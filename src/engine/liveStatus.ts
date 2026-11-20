/**
 * @file liveStatus.ts
 * @description مخزن خفيف للقيم عالية التردد (إحداثيات المؤشر، نتيجة الالتقاط، الزوم).
 *
 * لماذا؟ سابقاً كانت هذه القيم حالات React داخل App، فكل حركة للفأرة أو إطار تكبير
 * يعيد رسم شجرة الواجهة كاملة (App + PropertiesPanel ~3600 سطر + LeftToolbar ...) عشرات المرات في الثانية.
 * الآن يشترك شريط الحالة وحده بهذه القيم عبر useSyncExternalStore، وتبقى بقية الواجهة ساكنة.
 */

import { useSyncExternalStore } from 'react';
import { Point } from '../model/types.ts';
import { SnapResult } from './snap.ts';
import type { WallDrawingState } from './renderer.ts';

export interface LiveStatusState {
  cursorWorld: Point;
  snapResult: SnapResult;
  zoom: number;
  wallDrawing: WallDrawingState | null;
  orthoMode: boolean;
}

let state: LiveStatusState = {
  cursorWorld: { x: 0, y: 0 },
  snapResult: { point: { x: 0, y: 0 }, snapped: false, type: 'none' },
  zoom: 1,
  wallDrawing: null,
  orthoMode: false,
};

const listeners = new Set<() => void>();
let notifyScheduled = false;

function scheduleNotify(): void {
  // تجميع التحديثات في إطار واحد (لا أكثر من تحديث واحد لكل إطار شاشة)
  if (notifyScheduled) return;
  notifyScheduled = true;
  requestAnimationFrame(() => {
    notifyScheduled = false;
    listeners.forEach((l) => l());
  });
}

export const liveStatus = {
  get(): LiveStatusState {
    return state;
  },
  setCursor(cursorWorld: Point, snapResult: SnapResult): void {
    state = { ...state, cursorWorld, snapResult };
    scheduleNotify();
  },
  setZoom(zoom: number): void {
    if (zoom === state.zoom) return;
    state = { ...state, zoom };
    scheduleNotify();
  },
  setWallDrawing(wallDrawing: WallDrawingState | null): void {
    state = { ...state, wallDrawing };
    scheduleNotify();
  },
  setOrthoMode(orthoMode: boolean): void {
    state = { ...state, orthoMode };
    scheduleNotify();
  },
  /** إعادة إشعار المشتركين (مثلاً بعد تغيّر حالة أداة الرسم) */
  touch(): void {
    state = { ...state };
    scheduleNotify();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useLiveStatus(): LiveStatusState {
  return useSyncExternalStore(liveStatus.subscribe, liveStatus.get, liveStatus.get);
}
