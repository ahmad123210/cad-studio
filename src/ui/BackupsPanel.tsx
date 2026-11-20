/**
 * @file BackupsPanel.tsx
 * @description النسخ الاحتياطية التلقائية (IndexedDB): عرض آخر 10 نسخ للمشروع الحالي واستعادة أيٍّ منها.
 * الاستعادة تحفظ الحالة الحالية أولاً كنسخة احتياطية، فيمكن الرجوع عنها.
 */

import React, { useEffect, useState } from 'react';
import { History, RotateCcw, RefreshCw } from 'lucide-react';
import type { ProjectModel } from '../model/project.ts';
import type { BackupEntry } from '../model/storage.ts';

export const BackupsPanel: React.FC<{ model: ProjectModel; onRestored?: () => void }> = ({ model, onRestored }) => {
  const [items, setItems] = useState<BackupEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    model
      .listBackups()
      .then((l) => {
        setItems(l);
        setError(null);
      })
      .catch(() => setError('النسخ الاحتياطية غير متاحة في هذا المتصفح (IndexedDB معطّل).'));
  };
  useEffect(refresh, [model]);

  const restore = async (b: BackupEntry) => {
    if (!window.confirm(`استعادة نسخة ${new Date(b.savedAt).toLocaleString('ar')}؟ سيتم حفظ الحالة الحالية كنسخة احتياطية أولاً.`)) return;
    setBusy(true);
    try {
      const warnings = await model.restoreBackup(b.key);
      if (warnings.length) alert('تمت الاستعادة مع ملاحظات:\n' + warnings.join('\n'));
      onRestored?.();
      refresh();
    } catch (err) {
      alert('تعذّرت الاستعادة: ' + (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const backupNow = async () => {
    setBusy(true);
    const r = await model.saveLocal({ forceBackup: true });
    if (!r.indexedDb) setError('تعذّر إنشاء نسخة احتياطية (IndexedDB غير متاح).');
    setBusy(false);
    refresh();
  };

  return (
    <div className="p-3 bg-[var(--cad-panel-bg)] border border-[var(--cad-border)] rounded-lg space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[var(--cad-text-secondary)] flex items-center gap-1.5">
          <History size={14} className="text-violet-400" />
          النسخ الاحتياطية التلقائية (آخر 10 نسخ)
        </span>
        <div className="flex items-center gap-1">
          <button onClick={refresh} className="p-1 rounded hover:bg-[var(--cad-surface-hover)]" title="تحديث القائمة">
            <RefreshCw size={12} />
          </button>
          <button
            onClick={backupNow}
            disabled={busy}
            className="px-2 py-0.5 rounded bg-violet-600 hover:bg-violet-500 text-white text-[11px] disabled:opacity-50"
          >
            نسخة الآن
          </button>
        </div>
      </div>
      {error && <p className="text-[11px] text-rose-400">{error}</p>}
      {items && items.length === 0 && !error && (
        <p className="text-[11px] text-[var(--cad-text-muted)]">لا توجد نسخ بعد؛ تُنشأ تلقائياً عند الحفظ (بحد أدنى كل دقيقتين).</p>
      )}
      {items && items.length > 0 && (
        <ul className="max-h-40 overflow-y-auto divide-y divide-[var(--cad-border)] text-[11px]">
          {items.map((b) => (
            <li key={b.key} className="flex items-center justify-between py-1.5 gap-2">
              <span className="font-mono-cad">{new Date(b.savedAt).toLocaleString('ar')}</span>
              <span className="text-[var(--cad-text-muted)]">{b.objectCount} عنصر</span>
              <button
                onClick={() => restore(b)}
                disabled={busy}
                className="flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--cad-border)] hover:bg-[var(--cad-surface-hover)] disabled:opacity-50"
              >
                <RotateCcw size={11} /> استعادة
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
