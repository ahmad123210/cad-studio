/**
 * @file RouteControlBar.tsx
 * @description شريط تحكم عائم أثناء رسم المسارات والكابلات والمواسير (المرحلة 5).
 * يتيح اختيار تخصص المسار (كهرباء، سباكة، تكييف، حريق)، وإنهاء المسار أو إلغائه،
 * مع عرض إرشادات المحاذاة المتعامدة (Ortho) والارتباط بالرموز.
 */

import React from 'react';
import { GitBranch, Check, X, Zap, Droplet, Wind, Flame, Info, Sparkles } from 'lucide-react';
import { RouteKind } from '../model/types.ts';
import { ROUTE_KINDS_META } from '../symbols/routes.ts';

interface RouteControlBarProps {
  activeKind: RouteKind;
  onSelectKind: (kind: RouteKind) => void;
  activeLineStyle?: 'solid' | 'dashed' | 'dotted';
  onSelectLineStyle?: (style: 'solid' | 'dashed' | 'dotted') => void;
  pointsCount: number;
  currentLengthMeters: number;
  onFinishRoute: () => void;
  onCancelRoute: () => void;
}

export const RouteControlBar: React.FC<RouteControlBarProps> = ({
  activeKind,
  onSelectKind,
  activeLineStyle = 'solid',
  onSelectLineStyle,
  pointsCount,
  currentLengthMeters,
  onFinishRoute,
  onCancelRoute,
}) => {
  const meta = ROUTE_KINDS_META[activeKind];

  const disciplines: { kind: RouteKind; label: string; icon: React.ReactNode; color: string }[] = [
    { kind: 'electrical', label: 'كهرباء', icon: <Zap size={13} />, color: '#f59e0b' },
    { kind: 'water', label: 'مياه', icon: <Droplet size={13} />, color: '#3b82f6' },
    { kind: 'drainage', label: 'صرف', icon: <Droplet size={13} />, color: '#8b5cf6' },
    { kind: 'hvac', label: 'تكييف', icon: <Wind size={13} />, color: '#10b981' },
    { kind: 'fire', label: 'إطفاء حريق', icon: <Flame size={13} />, color: '#ef4444' },
  ];

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-neutral-900/95 border border-amber-500/40 backdrop-blur-md rounded-2xl shadow-2xl p-2.5 flex items-center gap-3 text-xs text-neutral-200 select-none animate-in fade-in slide-in-from-top-3 max-w-[95vw]">
      {/* أيقونة واسم الأداة */}
      <div className="flex items-center gap-2 pr-1 border-r border-neutral-800">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm"
          style={{ backgroundColor: meta.defaultColor }}
        >
          <GitBranch size={16} />
        </div>
        <div>
          <span className="font-bold text-white text-xs block">رسم مسار MEP</span>
          <span className="text-[10px] text-neutral-400 font-mono-cad">
            {pointsCount === 0 ? 'انقر للبدء' : `${pointsCount} نقاط مسجلة`}
          </span>
        </div>
      </div>

      {/* أزرار اختيار نظام المسار */}
      <div className="flex items-center gap-1 bg-neutral-950/70 p-1 rounded-xl border border-neutral-800">
        {disciplines.map((d) => (
          <button
            key={d.kind}
            type="button"
            onClick={() => onSelectKind(d.kind)}
            className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              activeKind === d.kind
                ? 'text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
            style={{
              backgroundColor: activeKind === d.kind ? d.color : 'transparent',
            }}
          >
            {d.icon}
            <span>{d.label}</span>
          </button>
        ))}
      </div>

      {/* أزرار اختيار نمط الخط (مستمر / متقطع / منقط) */}
      {onSelectLineStyle && (
        <div className="flex items-center gap-1 bg-neutral-950/70 p-1 rounded-xl border border-neutral-800">
          <button
            type="button"
            onClick={() => onSelectLineStyle('solid')}
            className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeLineStyle === 'solid'
                ? 'bg-neutral-700 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
            title="خط مستمر (Solid)"
          >
            ── مستمر
          </button>
          <button
            type="button"
            onClick={() => onSelectLineStyle('dashed')}
            className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeLineStyle === 'dashed'
                ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40 shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
            title="خط متقطع (Dashed)"
          >
            ╌╌ متقطع
          </button>
          <button
            type="button"
            onClick={() => onSelectLineStyle('dotted')}
            className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeLineStyle === 'dotted'
                ? 'bg-sky-600/30 text-sky-300 border border-sky-500/40 shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
            title="خط منقط (Dotted)"
          >
            ···· منقط
          </button>
        </div>
      )}

      {/* الطول الحي المحسوب */}
      {pointsCount >= 2 && (
        <div className="flex items-center gap-1.5 px-2 font-mono-cad">
          <span className="text-[10px] text-neutral-400 font-sans">الطول:</span>
          <span className="text-sm font-extrabold text-emerald-400">{currentLengthMeters.toFixed(2)} م</span>
        </div>
      )}

      {/* زر الإنهاء والإلغاء */}
      <div className="flex items-center gap-1.5 pl-1 border-l border-neutral-800">
        {pointsCount >= 2 ? (
          <button
            onClick={onFinishRoute}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md shadow-emerald-950/50 transition-colors"
            title="إنهاء المسار وحفظه (Enter أو نقر مزدوج)"
          >
            <Check size={14} />
            <span>إنهاء (Enter)</span>
          </button>
        ) : (
          <span className="text-[10px] text-neutral-400 px-1 hidden md:inline">
            اضغط Shift لزاوية قائمة (Ortho)
          </span>
        )}

        <button
          onClick={onCancelRoute}
          className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg transition-colors"
          title="إلغاء الرسم (Esc)"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
