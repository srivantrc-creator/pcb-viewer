import {
  parseSExpr,
  isList,
  tag,
  find,
  findAll,
  args,
  num,
  str,
  type SExprNode,
} from "./sexpr";
import type {
  PcbBoard,
  Footprint,
  PadItem,
  PadShape,
  TrackItem,
  ViaItem,
  ZoneItem,
  GraphicItem,
  TextItem,
  BoardItem,
  Point,
} from "./types";

function rotate(p: Point, angleDeg: number): Point {
  if (!angleDeg) return p;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

function translate(p: Point, by: Point): Point {
  return { x: p.x + by.x, y: p.y + by.y };
}

/** Read an (at x y [rot]) node into {x, y, rotation}. */
function readAt(node: SExprNode[] | undefined): { x: number; y: number; rotation: number } {
  if (!node) return { x: 0, y: 0, rotation: 0 };
  const a = args(node);
  return {
    x: typeof a[0] === "number" ? a[0] : 0,
    y: typeof a[1] === "number" ? a[1] : 0,
    rotation: typeof a[2] === "number" ? a[2] : 0,
  };
}

function readLayers(node: SExprNode[] | undefined): string[] {
  if (!node) return [];
  return args(node).filter((a): a is string => typeof a === "string");
}

function readNet(node: SExprNode[] | undefined): number | undefined {
  if (!node) return undefined;
  const n = num(node, 0, -1);
  return n >= 0 ? n : undefined;
}

function padShapeFromToken(tok: string): PadShape {
  switch (tok) {
    case "circle":
    case "rect":
    case "oval":
    case "roundrect":
    case "custom":
    case "trapezoid":
      return tok;
    default:
      return "rect";
  }
}

function parsePad(
  padNode: SExprNode[],
  origin: { x: number; y: number; rotation: number },
  refDes: string
): PadItem {
  const [, padNumberRaw, mountType, shapeTok] = padNode as [
    string,
    string | number,
    string,
    string
  ];
  const at = readAt(find(padNode, "at"));
  const sizeNode = find(padNode, "size");
  const size = sizeNode
    ? { w: num(sizeNode, 0, 1), h: num(sizeNode, 1, 1) }
    : { w: 1, h: 1 };
  const layers = readLayers(find(padNode, "layers"));
  const netNode = find(padNode, "net");
  const netId = netNode ? num(netNode, 0, undefined as unknown as number) : undefined;
  const isThru = mountType === "thru_hole" || mountType === "np_thru_hole";
  const drillNode = find(padNode, "drill");
  const drill = isThru && drillNode ? num(drillNode, 0, undefined as unknown as number) : undefined;

  // Local pad position, rotated by the pad's own rotation then by the
  // footprint's rotation, then translated into board space.
  const localRotated = rotate({ x: at.x, y: at.y }, origin.rotation);
  const absolute = translate(localRotated, { x: origin.x, y: origin.y });

  return {
    kind: "pad",
    padNumber: String(padNumberRaw),
    at: absolute,
    size,
    shape: padShapeFromToken(String(shapeTok)),
    rotation: at.rotation + origin.rotation,
    layers,
    isThroughHole: isThru,
    drill,
    // Through-hole pads span every copper layer, so they get a synthetic
    // "Through" bucket rendered whenever either copper side is visible,
    // rather than being tied to one side arbitrarily.
    layer: isThru ? "Through" : layers[0] ?? "F.Cu",
    netId,
    refDes,
  };
}

function parseFootprint(fpNode: SExprNode[]): Footprint {
  const origin = readAt(find(fpNode, "at"));
  const layer = str(find(fpNode, "layer"), 0, "F.Cu");

  let reference = "?";
  let value = "";
  const texts: TextItem[] = [];

  for (const child of fpNode) {
    if (isList(child) && tag(child) === "fp_text") {
      const kind = args(child)[0];
      const text = args(child)[1];
      if (kind === "reference" && typeof text === "string") reference = text;
      if (kind === "value" && typeof text === "string") value = text;

      // Render only reference/value silkscreen labels (skip hidden user text
      // layers like F.Fab) to keep the demo readable.
      const textLayer = str(find(child, "layer"), 0, "");
      if (typeof text === "string" && (textLayer === "F.SilkS" || textLayer === "B.SilkS")) {
        const local = readAt(find(child, "at"));
        const rotated = rotate({ x: local.x, y: local.y }, origin.rotation);
        const absolute = translate(rotated, { x: origin.x, y: origin.y });
        const effects = find(child, "effects");
        const fontNode = effects ? find(effects, "font") : undefined;
        const sizeNode = fontNode ? find(fontNode, "size") : undefined;
        texts.push({
          kind: "text",
          text,
          at: absolute,
          // Keep silkscreen labels upright regardless of footprint rotation
          // (KiCad renders them tilted; for a viewer, legibility wins).
          rotation: 0,
          size: sizeNode ? num(sizeNode, 0, 0.8) : 0.8,
          layer: textLayer,
          refDes: reference,
        });
      }
    }
    // KiCad 7+ uses "property" for reference/value in some exports; fall back.
    if (isList(child) && tag(child) === "property") {
      const key = args(child)[0];
      const val = args(child)[1];
      if (key === "Reference" && typeof val === "string") reference = val;
      if (key === "Value" && typeof val === "string") value = val;
    }
  }

  const pads = findAll(fpNode, "pad").map((p) => parsePad(p, origin, reference));
  // Reference designator text needs `refDes` set now that we know it (the
  // loop above may see fp_text before the reference token is confirmed).
  for (const t of texts) t.refDes = reference;

  return {
    reference,
    value,
    at: { x: origin.x, y: origin.y },
    rotation: origin.rotation,
    layer,
    pads,
    texts,
  };
}

function parseSegment(node: SExprNode[]): TrackItem {
  const start = readAt(find(node, "start"));
  const end = readAt(find(node, "end"));
  return {
    kind: "track",
    start: { x: start.x, y: start.y },
    end: { x: end.x, y: end.y },
    width: num(find(node, "width"), 0, 0.2),
    layer: str(find(node, "layer"), 0, "F.Cu"),
    netId: readNet(find(node, "net")),
  };
}

function parseVia(node: SExprNode[]): ViaItem {
  const at = readAt(find(node, "at"));
  const layers = readLayers(find(node, "layers"));
  return {
    kind: "via",
    at: { x: at.x, y: at.y },
    size: num(find(node, "size"), 0, 0.6),
    drill: num(find(node, "drill"), 0, 0.3),
    layers,
    // Vias always span multiple copper layers, so bucket them the same way
    // as through-hole pads (see parsePad above).
    layer: "Through",
    netId: readNet(find(node, "net")),
  };
}

function collectPts(node: SExprNode[] | undefined): Point[] {
  if (!node) return [];
  const ptsNode = find(node, "pts");
  if (!ptsNode) return [];
  const points: Point[] = [];
  for (const child of ptsNode) {
    if (isList(child) && tag(child) === "xy") {
      points.push({ x: num(child, 0), y: num(child, 1) });
    }
  }
  return points;
}

function parseZone(node: SExprNode[]): ZoneItem | undefined {
  const layerNode = find(node, "layer");
  const layersNode = find(node, "layers");
  const layer = layerNode ? str(layerNode, 0) : readLayers(layersNode)[0];
  if (!layer) return undefined;

  const polyNode = find(node, "polygon");
  const points = collectPts(polyNode);
  if (points.length < 3) return undefined;

  return {
    kind: "zone",
    polygon: points,
    layer,
    netId: readNet(find(node, "net")),
  };
}

function parseGraphicLine(node: SExprNode[], tagName: string): GraphicItem | undefined {
  const layer = str(find(node, "layer"), 0, "");
  if (!layer) return undefined;
  const width = num(find(node, "width"), 0, num(find(node, "stroke") ?? [], 0, 0.1));

  if (tagName === "gr_line" || tagName === "fp_line") {
    const start = readAt(find(node, "start"));
    const end = readAt(find(node, "end"));
    return {
      kind: "graphic",
      shape: "line",
      points: [
        { x: start.x, y: start.y },
        { x: end.x, y: end.y },
      ],
      width,
      layer,
    };
  }

  if (tagName === "gr_rect" || tagName === "fp_rect") {
    const start = readAt(find(node, "start"));
    const end = readAt(find(node, "end"));
    return {
      kind: "graphic",
      shape: "rect",
      points: [
        { x: start.x, y: start.y },
        { x: end.x, y: end.y },
      ],
      width,
      layer,
    };
  }

  if (tagName === "gr_circle" || tagName === "fp_circle") {
    const center = readAt(find(node, "center"));
    const end = readAt(find(node, "end"));
    const radius = Math.hypot(end.x - center.x, end.y - center.y);
    return {
      kind: "graphic",
      shape: "circle",
      points: [{ x: center.x, y: center.y }],
      radius,
      width,
      layer,
    };
  }

  if (tagName === "gr_poly" || tagName === "fp_poly") {
    const points = collectPts(node);
    if (points.length < 3) return undefined;
    return { kind: "graphic", shape: "poly", points, width, layer };
  }

  return undefined;
}

function parseGrText(node: SExprNode[]): TextItem | undefined {
  const text = args(node)[0];
  if (typeof text !== "string") return undefined;
  const at = readAt(find(node, "at"));
  const layer = str(find(node, "layer"), 0, "");
  if (!layer) return undefined;
  const effects = find(node, "effects");
  const fontNode = effects ? find(effects, "font") : undefined;
  const sizeNode = fontNode ? find(fontNode, "size") : undefined;
  return {
    kind: "text",
    text,
    at: { x: at.x, y: at.y },
    rotation: at.rotation,
    size: sizeNode ? num(sizeNode, 0, 1) : 1,
    layer,
  };
}

export function parseKicadPcb(source: string): PcbBoard {
  const roots = parseSExpr(source);
  const root = roots.find((n) => isList(n) && tag(n) === "kicad_pcb") as
    | SExprNode[]
    | undefined;
  if (!root) {
    throw new Error(
      "This doesn't look like a KiCad PCB file (missing kicad_pcb root node)."
    );
  }

  // Layers
  const layersNode = find(root, "layers");
  const layers: PcbBoard["layers"] = [];
  if (layersNode) {
    for (const child of layersNode) {
      if (isList(child) && typeof child[0] === "number") {
        layers.push({
          ordinal: child[0],
          name: String(child[1] ?? ""),
          type: String(child[2] ?? ""),
        });
      }
    }
  }

  // Nets (top-level siblings: (net 0 "") (net 1 "GND") ...)
  const nets = new Map<number, { id: number; name: string }>();
  for (const child of root) {
    if (isList(child) && tag(child) === "net") {
      const id = num(child, 0, 0);
      const name = str(child, 1, "");
      nets.set(id, { id, name });
    }
  }

  // Footprints and their pads
  const footprints = findAll(root, "footprint").map(parseFootprint);
  if (footprints.length === 0) {
    // KiCad < 6 used "module" instead of "footprint".
    footprints.push(...findAll(root, "module").map(parseFootprint));
  }

  const items: BoardItem[] = [];
  for (const fp of footprints) {
    items.push(...fp.pads);
    items.push(...fp.texts);
  }

  for (const seg of findAll(root, "segment")) items.push(parseSegment(seg));
  for (const via of findAll(root, "via")) items.push(parseVia(via));
  for (const zone of findAll(root, "zone")) {
    const z = parseZone(zone);
    if (z) items.push(z);
  }

  const graphicTags = ["gr_line", "gr_rect", "gr_circle", "gr_poly"];
  for (const t of graphicTags) {
    for (const g of findAll(root, t)) {
      const parsed = parseGraphicLine(g, t);
      if (parsed) items.push(parsed);
    }
  }
  for (const t of ["gr_text"]) {
    for (const g of findAll(root, t)) {
      const parsed = parseGrText(g);
      if (parsed) items.push(parsed);
    }
  }

  // Board outline = Edge.Cuts graphics
  const outlineSegments: { start: Point; end: Point }[] = [];
  for (const item of items) {
    if (item.kind === "graphic" && item.layer === "Edge.Cuts") {
      if (item.shape === "line" || item.shape === "rect") {
        outlineSegments.push({ start: item.points[0], end: item.points[1] });
        if (item.shape === "rect") {
          const [p1, p2] = item.points;
          outlineSegments.push({ start: { x: p1.x, y: p2.y }, end: p2 });
          outlineSegments.push({ start: p2, end: { x: p2.x, y: p1.y } });
          outlineSegments.push({ start: { x: p2.x, y: p1.y }, end: p1 });
        }
      } else if (item.shape === "poly") {
        for (let i = 0; i < item.points.length; i++) {
          const start = item.points[i];
          const end = item.points[(i + 1) % item.points.length];
          outlineSegments.push({ start, end });
        }
      }
    }
  }

  // Bounds, for auto-fit viewport. Fall back to all-items bounds if there's
  // no explicit Edge.Cuts outline in the file.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const consider = (p: Point) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  };
  if (outlineSegments.length > 0) {
    for (const seg of outlineSegments) {
      consider(seg.start);
      consider(seg.end);
    }
  } else {
    for (const item of items) {
      if (item.kind === "track") {
        consider(item.start);
        consider(item.end);
      } else if (item.kind === "via" || item.kind === "pad" || item.kind === "text") {
        consider(item.at);
      } else if (item.kind === "zone") {
        item.polygon.forEach(consider);
      } else if (item.kind === "graphic") {
        item.points.forEach(consider);
      }
    }
  }
  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 50;
    maxY = 50;
  }

  return {
    layers,
    nets,
    footprints,
    items,
    outline: { segments: outlineSegments },
    bounds: { minX, minY, maxX, maxY },
  };
}
