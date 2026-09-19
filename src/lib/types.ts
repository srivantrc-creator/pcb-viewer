// Domain model for a parsed PCB, independent of the KiCad file syntax.
// The renderer and net-highlighting logic work against these shapes.

export interface Point {
  x: number;
  y: number;
}

export interface NetInfo {
  id: number;
  name: string;
}

export type ItemKind = "track" | "via" | "pad" | "zone" | "graphic" | "text";

export interface BaseItem {
  kind: ItemKind;
  layer: string;
  netId?: number;
  refDes?: string; // owning footprint reference, if any (e.g. "R1")
}

export interface TrackItem extends BaseItem {
  kind: "track";
  start: Point;
  end: Point;
  width: number;
}

export interface ViaItem extends BaseItem {
  kind: "via";
  at: Point;
  size: number;
  drill: number;
  layers: string[]; // vias span layers, but we keep a primary `layer` for grouping
}

export type PadShape = "circle" | "rect" | "roundrect" | "oval" | "custom" | "trapezoid";

export interface PadItem extends BaseItem {
  kind: "pad";
  padNumber: string;
  at: Point; // absolute board coordinates (footprint placement + local offset + rotation applied)
  size: { w: number; h: number };
  shape: PadShape;
  rotation: number;
  layers: string[];
  isThroughHole: boolean;
  drill?: number;
}

export interface ZoneItem extends BaseItem {
  kind: "zone";
  polygon: Point[];
}

export interface GraphicItem extends BaseItem {
  kind: "graphic";
  shape: "line" | "rect" | "circle" | "arc" | "poly";
  points: Point[]; // for line: [start,end]; rect: [p1,p2]; circle: [center] with radius; poly: full ring
  radius?: number;
  width: number;
}

export interface TextItem extends BaseItem {
  kind: "text";
  at: Point;
  rotation: number;
  text: string;
  size: number;
}

export type BoardItem = TrackItem | ViaItem | PadItem | ZoneItem | GraphicItem | TextItem;

export interface Footprint {
  reference: string;
  value: string;
  at: Point;
  rotation: number;
  layer: string;
  pads: PadItem[];
  texts: TextItem[];
}

export interface BoardOutline {
  segments: { start: Point; end: Point }[];
}

export interface PcbBoard {
  layers: { ordinal: number; name: string; type: string }[];
  nets: Map<number, NetInfo>;
  footprints: Footprint[];
  items: BoardItem[];
  outline: BoardOutline;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}
