// Produces a textbook-style orthogonal schematic layout from a netlist:
// non-ground nodes sit on a column/row grid, elements between two non-
// ground nodes are drawn as straight or single-bend wires, and any element
// touching ground drops straight down onto a shared ground rail (with
// extra ground connections from the same node jogging sideways first, so
// they don't overlap — this is what produces the classic "Rx straight down,
// Rb over-then-down" look for a resistor in parallel with a load).

import type { CircuitElement, Netlist } from "./circuitTypes";

export interface Pt {
  x: number;
  y: number;
}

export interface ElementRoute {
  element: CircuitElement;
  path: Pt[]; // 2 or 3 points describing the wire polyline
  symbolStart: Pt; // the sub-segment of `path` where the component symbol is drawn
  symbolEnd: Pt;
  orientation: "h" | "v";
  /** True if element.nodeA (the "+"/reference terminal) sits at `symbolStart` rather than `symbolEnd`. */
  positiveAtStart: boolean;
}

export interface SchematicLayout {
  nodePos: Map<number, Pt>;
  groundY: number | null;
  groundXRange: [number, number] | null;
  groundSymbolX: number | null;
  routes: ElementRoute[];
  width: number;
  height: number;
}

const COL_WIDTH = 150;
const ROW_HEIGHT = 100;
const START_X = 90;
const START_Y = 70;
const GROUND_GAP = 60;

export function layoutSchematic(netlist: Netlist): SchematicLayout {
  const elements = netlist.elements;

  // Rail edges: elements between two non-ground nodes drive the column BFS.
  const railEdges: { a: number; b: number }[] = [];
  const allNonGroundNodes = new Set<number>();
  for (const el of elements) {
    if (el.nodeA !== 0) allNonGroundNodes.add(el.nodeA);
    if (el.nodeB !== 0) allNonGroundNodes.add(el.nodeB);
    if (el.nodeA !== 0 && el.nodeB !== 0) railEdges.push({ a: el.nodeA, b: el.nodeB });
  }

  const adjacency = new Map<number, number[]>();
  for (const { a, b } of railEdges) {
    (adjacency.get(a) ?? adjacency.set(a, []).get(a)!).push(b);
    (adjacency.get(b) ?? adjacency.set(b, []).get(b)!).push(a);
  }

  const col = new Map<number, number>();
  const componentOf = new Map<number, number>();
  const componentVisitOrder: number[][] = [];
  const remaining = new Set(allNonGroundNodes);
  let componentIdx = 0;

  while (remaining.size > 0) {
    const root = [...remaining].sort((x, y) => x - y)[0];
    const queue = [root];
    const thisVisitOrder: number[] = [root];
    col.set(root, 0);
    componentOf.set(root, componentIdx);
    remaining.delete(root);
    let head = 0;
    while (head < queue.length) {
      const u = queue[head++];
      for (const v of adjacency.get(u) ?? []) {
        if (!remaining.has(v)) continue;
        const c = col.get(u)! + 1;
        col.set(v, c);
        componentOf.set(v, componentIdx);
        remaining.delete(v);
        thisVisitOrder.push(v);
        queue.push(v);
      }
    }
    componentVisitOrder.push(thisVisitOrder);
    componentIdx += 1;
  }

  // Row assignment: first node to claim a column gets row 0 in that column;
  // later ones stack below. Processed in BFS visit order so simple chains
  // stay on one row, matching how you'd draw them by hand. Each disconnected
  // sub-circuit gets its own row band (via rowOffset) so components never
  // overlap in row-space even when they reuse the same column indices.
  const row = new Map<number, number>();
  let rowOffset = 0;
  for (const visitOrder of componentVisitOrder) {
    const colRowCounter = new Map<number, number>();
    let maxRowInComponent = 0;
    for (const n of visitOrder) {
      const c = col.get(n)!;
      const r = colRowCounter.get(c) ?? 0;
      row.set(n, rowOffset + r);
      colRowCounter.set(c, r + 1);
      maxRowInComponent = Math.max(maxRowInComponent, r);
    }
    rowOffset += maxRowInComponent + 2; // gap between disconnected sub-circuits
  }

  const maxColUsed = Math.max(0, ...[...col.values()]);
  let nextFreeCol = maxColUsed + 1;

  const nodePos = new Map<number, Pt>();
  for (const n of allNonGroundNodes) {
    nodePos.set(n, {
      x: START_X + col.get(n)! * COL_WIDTH,
      y: START_Y + row.get(n)! * ROW_HEIGHT,
    });
  }

  const maxRowUsed = Math.max(0, ...[...row.values()]);
  const groundY = START_Y + (maxRowUsed + 1) * ROW_HEIGHT;

  const allNodePositions = [...nodePos.values()];

  // Tracks wire segments already drawn, so later elements can route around
  // them instead of overlapping — e.g. a resistor's branch running through
  // the same column as another element's drop to ground.
  const vSpans = new Map<number, [number, number][]>(); // x -> [yMin, yMax][]
  const hSpans = new Map<number, [number, number][]>(); // y -> [xMin, xMax][]
  const overlaps1D = (aMin: number, aMax: number, bMin: number, bMax: number) => aMin < bMax && bMin < aMax;
  function vCollides(x: number, y1: number, y2: number): boolean {
    const yMin = Math.min(y1, y2);
    const yMax = Math.max(y1, y2);
    if (allNodePositions.some((p) => p.x === x && p.y > yMin && p.y < yMax)) return true;
    return (vSpans.get(x) ?? []).some(([a, b]) => overlaps1D(yMin, yMax, a, b));
  }
  function hCollides(y: number, x1: number, x2: number): boolean {
    const xMin = Math.min(x1, x2);
    const xMax = Math.max(x1, x2);
    if (allNodePositions.some((p) => p.y === y && p.x > xMin && p.x < xMax)) return true;
    return (hSpans.get(y) ?? []).some(([a, b]) => overlaps1D(xMin, xMax, a, b));
  }
  function registerV(x: number, y1: number, y2: number) {
    const arr = vSpans.get(x) ?? [];
    arr.push([Math.min(y1, y2), Math.max(y1, y2)]);
    vSpans.set(x, arr);
  }
  function registerH(y: number, x1: number, x2: number) {
    const arr = hSpans.get(y) ?? [];
    arr.push([Math.min(x1, x2), Math.max(x1, x2)]);
    hSpans.set(y, arr);
  }

  const FLYOVER_LANE_GAP = 34;
  const flyoverBaseY = groundY + GROUND_GAP + 30;
  let flyoverLaneIdx = 0;

  const routes: ElementRoute[] = [];
  const groundDropUsedByNode = new Set<number>();
  const groundDropXs: number[] = [];
  let preferredGroundSymbolX: number | null = null;
  let fallbackGroundSymbolX: number | null = null;

  for (const el of elements) {
    const aIsGround = el.nodeA === 0;
    const bIsGround = el.nodeB === 0;

    if (aIsGround && bIsGround) continue; // both terminals grounded — degenerate, nothing to draw

    if (aIsGround || bIsGround) {
      const otherNode = aIsGround ? el.nodeB : el.nodeA;
      const otherPos = nodePos.get(otherNode)!;
      let symbolStart: Pt;
      let symbolEnd: Pt;
      let path: Pt[];
      let dropX: number;

      if (!groundDropUsedByNode.has(otherNode) && !vCollides(otherPos.x, otherPos.y, groundY)) {
        groundDropUsedByNode.add(otherNode);
        symbolStart = otherPos;
        symbolEnd = { x: otherPos.x, y: groundY };
        path = [symbolStart, symbolEnd];
        dropX = otherPos.x;
        registerV(otherPos.x, otherPos.y, groundY);
      } else {
        const stub: Pt = { x: START_X + nextFreeCol * COL_WIDTH, y: otherPos.y };
        nextFreeCol += 1;
        symbolStart = otherPos;
        symbolEnd = stub;
        path = [otherPos, stub, { x: stub.x, y: groundY }];
        dropX = stub.x;
        registerH(otherPos.y, otherPos.x, stub.x);
        registerV(stub.x, otherPos.y, groundY);
      }

      groundDropXs.push(dropX);
      if (el.type !== "vsource" && el.type !== "isource") {
        if (preferredGroundSymbolX === null) preferredGroundSymbolX = dropX;
      } else if (fallbackGroundSymbolX === null) {
        fallbackGroundSymbolX = dropX;
      }

      routes.push({
        element: el,
        path,
        symbolStart,
        symbolEnd,
        orientation: symbolStart.x === symbolEnd.x ? "v" : "h",
        positiveAtStart: el.nodeA === otherNode,
      });
      continue;
    }

    // Neither terminal is ground: a rail edge between two grid positions.
    const posA = nodePos.get(el.nodeA)!;
    const posB = nodePos.get(el.nodeB)!;

    if (posA.y === posB.y || posA.x === posB.x) {
      if (posA.y === posB.y) registerH(posA.y, posA.x, posB.x);
      else registerV(posA.x, posA.y, posB.y);
      routes.push({
        element: el,
        path: [posA, posB],
        symbolStart: posA,
        symbolEnd: posB,
        orientation: posA.y === posB.y ? "h" : "v",
        positiveAtStart: true,
      });
    } else {
      // Single-bend Manhattan route: try horizontal-at-A's-row-then-vertical
      // first, and vertical-then-horizontal second. A bridge-style network
      // can make either bend run straight through a column/row another
      // element already occupies (e.g. a node's own drop to ground) — in
      // that case fall back to a dedicated jog through a fresh column so
      // branches never draw on top of each other.
      const bendH: Pt = { x: posB.x, y: posA.y };
      const bendV: Pt = { x: posA.x, y: posB.y };
      const hOk = !hCollides(posA.y, posA.x, bendH.x) && !vCollides(bendH.x, bendH.y, posB.y);
      const vOk = !vCollides(posA.x, posA.y, bendV.y) && !hCollides(bendV.y, bendV.x, posB.x);

      if (hOk) {
        registerH(posA.y, posA.x, bendH.x);
        registerV(bendH.x, bendH.y, posB.y);
        routes.push({
          element: el,
          path: [posA, bendH, posB],
          symbolStart: posA,
          symbolEnd: bendH,
          orientation: "h",
          positiveAtStart: true,
        });
      } else if (vOk) {
        registerV(posA.x, posA.y, bendV.y);
        registerH(bendV.y, bendV.x, posB.x);
        routes.push({
          element: el,
          path: [posA, bendV, posB],
          symbolStart: posA,
          symbolEnd: bendV,
          orientation: "v",
          positiveAtStart: true,
        });
      } else {
        // Both direct bends run through track another element already
        // occupies (this happens on genuinely non-planar networks, like a
        // bridge circuit's cross-branch). Fly the wire over everything else
        // on its own dedicated lane below the ground rail, where nothing
        // else is routed, so it never overlaps another element.
        const laneY = flyoverBaseY + flyoverLaneIdx * FLYOVER_LANE_GAP;
        flyoverLaneIdx += 1;
        const jog1: Pt = { x: posA.x, y: laneY };
        const jog2: Pt = { x: posB.x, y: laneY };
        registerV(posA.x, posA.y, laneY);
        registerH(laneY, posA.x, posB.x);
        registerV(posB.x, laneY, posB.y);
        routes.push({
          element: el,
          path: [posA, jog1, jog2, posB],
          symbolStart: jog1,
          symbolEnd: jog2,
          orientation: "h",
          positiveAtStart: true,
        });
      }
    }
  }

  const groundXRange: [number, number] | null =
    groundDropXs.length > 0 ? [Math.min(...groundDropXs), Math.max(...groundDropXs)] : null;
  const groundSymbolX = preferredGroundSymbolX ?? fallbackGroundSymbolX;

  const width = START_X + (nextFreeCol + 1) * COL_WIDTH;
  const baseHeight = groundXRange ? groundY + GROUND_GAP : START_Y + (maxRowUsed + 1) * ROW_HEIGHT + GROUND_GAP;
  const height = flyoverLaneIdx > 0 ? flyoverBaseY + flyoverLaneIdx * FLYOVER_LANE_GAP + 30 : baseHeight;

  return {
    nodePos,
    groundY: groundXRange ? groundY : null,
    groundXRange,
    groundSymbolX,
    routes,
    width,
    height,
  };
}

/** Derive a short current-label suffix from an element label, e.g. "Ra" -> "a", "R1" -> "1". */
export function currentSuffix(label: string): string {
  return label.length > 1 ? label.slice(1) : label;
}
