/**
 * @file context.ts
 * @description السياق المشترك الذي تستقبله كل لوحة خصائص فرعية.
 * يحتوي نفس المتغيرات التي كانت متاحة داخل PropertiesPanel قبل التقسيم، لضمان عدم تغيّر السلوك.
 */

import type { ProjectModel } from '../../model/project.ts';
import type { Layer, ProjectMeta, ProjectObject } from '../../model/types.ts';

export interface PanelContext {
  model: ProjectModel;
  selectedObjectId: string | null;
  selectedObjectIds: string[];
  onClearSelection: () => void;
  onClearCanvas: () => void;
  onOpenBackgroundModal: () => void;
  onOpenCalibrationModal: () => void;
  onOpenSymbolsCatalog?: () => void;
  onOpenScheduleBOQ?: () => void;
  onOpenExport?: () => void;
  onOpenSettings?: () => void;
  isVisible: boolean;
  onToggleVisible?: () => void;
  selectedObject: ProjectObject | null | undefined;
  layers: Layer[];
  meta: ProjectMeta;
  pixelsPerMeter: number;
  handleDelete: () => void;
  handleLayerChange: (layerId: string) => void;
}
