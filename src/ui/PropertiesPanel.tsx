/**
 * @file PropertiesPanel.tsx
 * @description لوحة الخصائص الجانبية (يمين الشاشة).
 * تعرض وتتيح تعديل خصائص العنصر المحدد (جدار، باب، نافذة) أو إحصائيات وإعدادات المشروع عند عدم التحديد.
 */

import React from 'react';
import { ProjectModel } from '../model/project.ts';
import { PanelContext } from './properties/context.ts';
import { MultiSelectionProperties } from './properties/MultiSelectionProperties.tsx';
import { WallProperties } from './properties/WallProperties.tsx';
import { DoorProperties } from './properties/DoorProperties.tsx';
import { WindowProperties } from './properties/WindowProperties.tsx';
import { DimensionProperties } from './properties/DimensionProperties.tsx';
import { SymbolProperties } from './properties/SymbolProperties.tsx';
import { RouteProperties } from './properties/RouteProperties.tsx';
import { TextProperties } from './properties/TextProperties.tsx';
import { ProjectSummary } from './properties/ProjectSummary.tsx';

// إعادة تصدير للتوافق مع أي استيراد سابق
export { PrecisionNumberInput } from './properties/inputs.tsx';

export interface PropertiesPanelProps {
  model: ProjectModel;
  selectedObjectId: string | null;
  selectedObjectIds?: string[];
  onClearSelection: () => void;
  onClearCanvas: () => void;
  onOpenBackgroundModal: () => void;
  onOpenCalibrationModal: () => void;
  onOpenSymbolsCatalog?: () => void;
  onOpenScheduleBOQ?: () => void;
  onOpenExport?: () => void;
  onOpenSettings?: () => void;
  isVisible?: boolean;
  onToggleVisible?: () => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  model,
  selectedObjectId,
  selectedObjectIds = [],
  onClearSelection,
  onClearCanvas,
  onOpenBackgroundModal,
  onOpenCalibrationModal,
  onOpenSymbolsCatalog,
  onOpenScheduleBOQ,
  onOpenExport,
  onOpenSettings,
  isVisible = true,
  onToggleVisible,
}) => {
  const selectedObject = selectedObjectId ? model.getObjectById(selectedObjectId) : null;
  const layers = model.getLayers();
  const meta = model.getMeta();
  const pixelsPerMeter = meta.scale || 50;

  // حذف العنصر المحدد
  const handleDelete = () => {
    if (!selectedObject) return;
    model.deleteObject(selectedObject.id);
    onClearSelection();
  };

  // تغيير الطبقة
  const handleLayerChange = (layerId: string) => {
    if (!selectedObject) return;
    model.updateObject(selectedObject.id, { layerId });
  };

  // سياق مشترك يُمرَّر لكل لوحة فرعية (نفس المتغيرات التي كانت متاحة داخل الكتل الأصلية)
  const ctx: PanelContext = {
    model,
    selectedObjectId,
    selectedObjectIds,
    onClearSelection,
    onClearCanvas,
    onOpenBackgroundModal,
    onOpenCalibrationModal,
    onOpenSymbolsCatalog,
    onOpenScheduleBOQ,
    onOpenExport,
    onOpenSettings,
    isVisible,
    onToggleVisible,
    selectedObject,
    layers,
    meta,
    pixelsPerMeter,
    handleDelete,
    handleLayerChange,
  };

  // شريط الإخفاء / الطي: إخفاء اللوحة كلياً لتحرير كامل مساحة العرض للكانفس (المرحلة 3)
  if (!isVisible) {
    return null;
  }

  // ============================================
  // حالة: تحديد عناصر متعددة (Multi-Selection & Bulk Edit)
  // ============================================
  if (selectedObjectIds && selectedObjectIds.length > 1) {
    return <MultiSelectionProperties {...ctx} />;
  }



  // ============================================
  // حالة 1: العنصر المحدد هو جدار (Wall)
  // ============================================
  if (selectedObject?.type === 'wall') {
    return <WallProperties {...ctx} />;
  }

  // ============================================
  // حالة 2: العنصر المحدد هو باب (Door)
  // ============================================
  if (selectedObject?.type === 'door') {
    return <DoorProperties {...ctx} />;
  }

  // ============================================
  // حالة 3: العنصر المحدد هو نافذة (Window)
  // ============================================
  if (selectedObject?.type === 'window') {
    return <WindowProperties {...ctx} />;
  }

  // ============================================
  // حالة 4: العنصر المحدد هو بُعد هندسي (Dimension - المرحلة 3)
  // ============================================
  if (selectedObject?.type === 'dimension') {
    return <DimensionProperties {...ctx} />;
  }

  // ============================================
  // حالة 5: العنصر المحدد هو رمز هندسي (Symbol - المرحلة 4)
  // ============================================
  if (selectedObject?.type === 'symbol') {
    return <SymbolProperties {...ctx} />;
  }

  // ============================================
  // حالة 6: العنصر المحدد هو مسار كهروميكانيكي (Route - المرحلة 5)
  // ============================================
  if (selectedObject?.type === 'route') {
    return <RouteProperties {...ctx} />;
  }

  // ============================================
  // حالة 6: العنصر المحدد هو ملاحظة وتلميح نصي (Text / Annotation Note Object)
  // ============================================
  if (selectedObject?.type === 'text') {
    return <TextProperties {...ctx} />;
  }

  return <ProjectSummary {...ctx} />;
};
