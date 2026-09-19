// Visual styling for each layer bucket, loosely modeled on KiCad's dark
// theme so the render reads as a "real" PCB tool rather than a generic chart.

export interface LayerStyle {
  id: string;
  label: string;
  color: string;
  /** Render order, back to front. Lower draws first (further back). */
  z: number;
  defaultVisible: boolean;
}

export const LAYER_STYLES: LayerStyle[] = [
  { id: "B.Cu", label: "Bottom Copper", color: "#4a90d9", z: 0, defaultVisible: true },
  { id: "F.Cu", label: "Top Copper", color: "#e8734a", z: 1, defaultVisible: true },
  { id: "Through", label: "Vias / Through-holes", color: "#d9d9d9", z: 2, defaultVisible: true },
  { id: "B.SilkS", label: "Bottom Silkscreen", color: "#c9963b", z: 3, defaultVisible: false },
  { id: "F.SilkS", label: "Top Silkscreen", color: "#f2f2f2", z: 4, defaultVisible: true },
  { id: "F.Fab", label: "Top Fabrication", color: "#5b7a99", z: 5, defaultVisible: false },
  { id: "B.Fab", label: "Bottom Fabrication", color: "#5b7a99", z: 5, defaultVisible: false },
  { id: "Edge.Cuts", label: "Board Outline", color: "#f5e642", z: 6, defaultVisible: true },
];

export const LAYER_ORDER: Record<string, number> = Object.fromEntries(
  LAYER_STYLES.map((l) => [l.id, l.z])
);

export function styleFor(layerId: string): LayerStyle {
  return (
    LAYER_STYLES.find((l) => l.id === layerId) ?? {
      id: layerId,
      label: layerId,
      color: "#888",
      z: 10,
      defaultVisible: false,
    }
  );
}

export const HIGHLIGHT_COLOR = "#ff3b8d";
export const BACKGROUND_COLOR = "#0e1420";
export const BOARD_FILL = "#132030";
