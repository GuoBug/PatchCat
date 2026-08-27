/**
 * @file src/components/panels/index.ts
 * @description Property Panels, Logs Drawer & Run Controls Components Barrel Export
 */

export interface PropertyPanelProps {
  selectedNodeId: string | null;
}

export interface LogsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}
