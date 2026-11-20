/**
 * @file inputs.tsx
 * @description حقول الإدخال المشتركة للوحة الخصائص (تسمية، ملاحظة، رقم دقيق)
 */

import React from 'react';
import {
  Trash2,
  Copy,
  FlipHorizontal,
  Layers,
  Ruler,
  Maximize,
  Compass,
  Info,
  ShieldAlert,
  DoorOpen,
  AppWindow,
  Sliders,
  Image as ImageIcon,
  ArrowRightLeft,
  Target,
  Sparkles,
  Zap,
  GitBranch,
  Droplet,
  Wind,
  Flame,
  FileSpreadsheet,
  FileDown,
  Link,
  Unlink,
  PanelRightClose,
  PanelRightOpen,
  Boxes,
  Plus,
  Minus,
  RotateCw,
  Settings,
  HardDrive,
  Type,
  AlignRight,
  AlignCenter,
  AlignLeft,
  Bold,
  Palette,
  Eye,
  EyeOff,
} from 'lucide-react';
import { ProjectModel } from '../../model/project.ts';
import { getLastUsedSettings, updateLastUsedSettings, saveLastUsedSymbolConfig } from '../../model/lastUsedSettings.ts';
import {
  WallObject,
  DoorObject,
  WindowObject,
  DimensionObject,
  SymbolObject,
  RouteObject,
  TextObject,
  RouteKind,
  DoorOpenDirection,
} from '../../model/types.ts';
import { SnapEngine } from '../../engine/snap.ts';
import { GridUtils } from '../../engine/grid.ts';
import { getSymbolById, CATEGORIES_META } from '../../symbols/registry.ts';
import {
  ROUTE_KINDS_META,
  calculateRoutePixelLength,
  calculateSegmentLengths,
} from '../../symbols/routes.ts';


interface LabelInputProps {
  value: string;
  placeholder?: string;
  onSave: (val: string, recordHistory?: boolean) => void;
  accentColorClass?: string;
}

/**
 * مكون إدخال نص التسمية التوضيحية مع استجابة فورية وحفظ سلس دون إبطاء المعالج
 */
export const LabelInput: React.FC<LabelInputProps> = ({
  value,
  placeholder,
  onSave,
  accentColorClass = 'focus:border-sky-500',
}) => {
  const [localVal, setLocalVal] = React.useState(value || '');

  React.useEffect(() => {
    setLocalVal(value || '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setLocalVal(next);
  };

  const handleBlur = () => {
    if (localVal !== (value || '')) {
      onSave(localVal, true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      type="text"
      dir="auto"
      placeholder={placeholder}
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none w-full transition-colors ${accentColorClass}`}
    />
  );
};

interface NoteTextareaProps {
  value: string;
  placeholder?: string;
  onSave: (val: string, recordHistory?: boolean) => void;
  accentColorClass?: string;
  autoSelect?: boolean;
}

/**
 * حقل نصي متعدد الأسطر مع استجابة فورية وتظليل النص الافتراضي تلقائياً عند الإنشاء
 */
export const NoteTextarea: React.FC<NoteTextareaProps> = ({
  value,
  placeholder,
  onSave,
  accentColorClass = 'focus:border-purple-500',
  autoSelect = true,
}) => {
  const [localVal, setLocalVal] = React.useState(value || '');
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    setLocalVal(value || '');
  }, [value]);

  React.useEffect(() => {
    if (textareaRef.current) {
      const timer = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setLocalVal(next);
    onSave(next, false);
  };

  const handleBlur = () => {
    if (localVal !== (value || '')) {
      onSave(localVal, true);
    }
  };

  return (
    <textarea
      ref={textareaRef}
      rows={3}
      dir="auto"
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={(e) => {
        const len = e.currentTarget.value.length;
        e.currentTarget.setSelectionRange(len, len);
      }}
      onKeyDown={(e) => e.stopPropagation()}
      placeholder={placeholder}
      className={`w-full bg-neutral-950/80 border border-neutral-700 rounded-xl p-2.5 text-xs text-neutral-100 placeholder-neutral-500 outline-none resize-y transition-colors leading-relaxed ${accentColorClass}`}
    />
  );
};

interface PrecisionNumberInputProps {
  value: number;
  unit?: string;
  step?: number | string;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  accentColorClass?: string;
  onIncrement?: () => void;
  onDecrement?: () => void;
  incrementTitle?: string;
  decrementTitle?: string;
  disabled?: boolean;
  presets?: number[];
  onSelectPreset?: (val: number) => void;
  presetColorClass?: string;
}

/**
 * مكون إدخال رقمي عالي الدقة (Precision Number Input)
 * يستبدل السلايدرات ويتيح كتابة القيم الدقيقة مباشرة (مثل 87.5سم) مع أزرار +/- للتعديل السريع
 */
export const PrecisionNumberInput: React.FC<PrecisionNumberInputProps> = ({
  value,
  unit,
  step = 'any',
  min,
  max,
  onChange,
  accentColorClass = 'focus-within:border-sky-500 border-neutral-700',
  onIncrement,
  onDecrement,
  incrementTitle = 'زيادة',
  decrementTitle = 'تقليل',
  disabled = false,
  presets,
  onSelectPreset,
  presetColorClass = 'bg-sky-600/30 text-sky-300 border-sky-500',
}) => {
  const [localVal, setLocalVal] = React.useState<string>(value.toString());
  const [isFocused, setIsFocused] = React.useState(false);

  React.useEffect(() => {
    if (!isFocused) {
      setLocalVal(value.toString());
    }
  }, [value, isFocused]);

  const handleCommit = (str: string) => {
    let parsed = parseFloat(str);
    if (isNaN(parsed)) {
      setLocalVal(value.toString());
      return;
    }
    if (min !== undefined && parsed < min) parsed = min;
    if (max !== undefined && parsed > max) parsed = max;
    const formatted = Math.round(parsed * 100) / 100;
    setLocalVal(formatted.toString());
    onChange(formatted);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleCommit(localVal);
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'ArrowUp' && onIncrement) {
      e.preventDefault();
      onIncrement();
    } else if (e.key === 'ArrowDown' && onDecrement) {
      e.preventDefault();
      onDecrement();
    }
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div
        className={`flex items-center gap-1.5 bg-neutral-950/60 p-1 rounded-lg border ${accentColorClass} transition-colors`}
      >
        {onDecrement && (
          <button
            type="button"
            disabled={disabled}
            onClick={onDecrement}
            className="w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-300 hover:text-white font-bold text-sm flex items-center justify-center border border-neutral-700 transition-all shrink-0 cursor-pointer disabled:opacity-50"
            title={decrementTitle}
          >
            <Minus size={13} />
          </button>
        )}

        <div className="flex-1 relative flex items-center min-w-0">
          <input
            type="number"
            step={step}
            min={min}
            max={max}
            disabled={disabled}
            value={localVal}
            onFocus={() => setIsFocused(true)}
            onChange={(e) => {
              const next = e.target.value;
              setLocalVal(next);
              const parsed = parseFloat(next);
              if (
                !isNaN(parsed) &&
                (min === undefined || parsed >= min) &&
                (max === undefined || parsed <= max)
              ) {
                onChange(Math.round(parsed * 100) / 100);
              }
            }}
            onBlur={() => {
              setIsFocused(false);
              handleCommit(localVal);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-neutral-900 border border-transparent rounded px-2.5 py-1 text-center font-mono-cad text-sm font-bold text-neutral-100 outline-none transition-colors"
          />
          {unit && (
            <span className="absolute left-2 text-[10px] font-mono-cad text-neutral-400 pointer-events-none select-none">
              {unit}
            </span>
          )}
        </div>

        {onIncrement && (
          <button
            type="button"
            disabled={disabled}
            onClick={onIncrement}
            className="w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-300 hover:text-white font-bold text-sm flex items-center justify-center border border-neutral-700 transition-all shrink-0 cursor-pointer disabled:opacity-50"
            title={incrementTitle}
          >
            <Plus size={13} />
          </button>
        )}
      </div>

      {presets && presets.length > 0 && (
        <div className="flex items-center gap-1">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                if (onSelectPreset) {
                  onSelectPreset(p);
                } else {
                  onChange(p);
                }
              }}
              className={`flex-1 py-1 text-[10px] font-mono-cad rounded border transition-colors ${
                Math.abs(value - p) < 0.25
                  ? `${presetColorClass} font-bold`
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
              }`}
            >
              {p}{unit || ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
