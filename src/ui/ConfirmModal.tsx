/**
 * @file ConfirmModal.tsx
 * @description نافذة تأكيد الإجراءات (مثل إنشاء مشروع جديد أو مسح اللوحة).
 */

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'تأكيد',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs select-none">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-5 text-neutral-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              confirmVariant === 'danger'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}
          >
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white">{title}</h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{message}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-neutral-500 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              confirmVariant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-sky-600 hover:bg-sky-500 text-white'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
