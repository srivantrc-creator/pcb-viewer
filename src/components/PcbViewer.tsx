import { useCallback, useMemo, useRef, useState } from "react";
import type { PcbBoard, BoardItem } from "../lib/types";
import { LAYER_ORDER, styleFor, HIGHLIGHT_COLOR, BOARD_FILL } from "../lib/layerStyle";

const VIEW_W = 1200;
const VIEW_H = 800;
const MARGIN = 70;

interface Transform {
  panX: number;
  panY: number;
  zoom: number;
}

interface PcbViewerProps {
  board: PcbBoard;
  visibleLayers: Set<string>;
  highlightedNet: number | undefined;
  netIndex: Map<number, BoardItem[]>;
  onSelectNet: (netId: number | undefined) => void;
}

function fitTransform(board: PcbBoard) {
  const { minX, minY, maxX, maxY } = board.bounds;
  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);
  const scale = Math.min((VIEW_W - MARGIN * 2) / w, (VIEW_H - MARGIN * 2) / h);
  const contentW = w * scale;
  const contentH = h * scale;
  const offsetX = (VIEW_W - contentW) / 2 - minX * scale;
  const offsetY = (VIEW_H - contentH) / 2 - minY * scale;
  return { scale, offsetX, offsetY };
}

function itemKey(item: BoardItem, i: number): string {
  return `${item.kind}-${item.layer}-${i}`;
}

export default function PcbViewer({
  board,
  visibleLayers,
  highlightedNet,
  netIndex,
  onSelectNet,
}: PcbViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState<Transform>({ panX: 0, panY: 0, zoom: 1 });
  const dragState = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const { scale, offsetX, offsetY } = useMemo(() => fitTransform(board), [board]);

  const highlightedItems = useMemo(() => {
    if (highlightedNet === undefined) return null;
    return new Set(netIndex.get(highlightedNet) ?? []);
  }, [highlightedNet, netIndex]);

  const toSvgPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const inv = ctm.inverse();
    const transformed = pt.matrixTransform(inv);
    return { x: transformed.x, y: transformed.y };
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const before = toSvgPoint(e.clientX, e.clientY);
      setTransform((t) => {
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const newZoom = Math.min(Math.max(t.zoom * factor, 0.4), 20);
        // Keep the point under the cursor fixed: solve for new pan so that
        // (before - pan) / zoom stays constant across the zoom change.
        const cx = (before.x - t.panX) / t.zoom;
        const cy = (before.y - t.panY) / t.zoom;
        return {
          zoom: newZoom,
          panX: before.x - cx * newZoom,
          panY: before.y - cy * newZoom,
        };
      });
    },
    [toSvgPoint]
  );

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = { x: e.clientX, y: e.clientY, panX: transform.panX, panY: transform.panY };
  }, [transform]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragState.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleFactor = VIEW_W / rect.width;
    const dx = (e.clientX - dragState.current.x) * scaleFactor;
    const dy = (e.clientY - dragState.current.y) * scaleFactor;
    setTransform((t) => ({ ...t, panX: dragState.current!.panX + dx, panY: dragState.current!.panY + dy }));
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    dragState.current = null;
    (e.target as Element).releasePointerCapture(e.pointerId);
  }, []);

  const resetView = useCallback(() => setTransform({ panX: 0, panY: 0, zoom: 1 }), []);

  // Group items by layer for ordered, per-layer rendering.
  const itemsByLayer = useMemo(() => {
    const map = new Map<string, BoardItem[]>();
    for (const item of board.items) {
      const list = map.get(item.layer);
      if (list) list.push(item);
      else map.set(item.layer, [item]);
    }
    return map;
  }, [board]);

  const orderedLayers = useMemo(
    () =>
      [...itemsByLayer.keys()].sort(
        (a, b) => (LAYER_ORDER[a] ?? 99) - (LAYER_ORDER[b] ?? 99)
      ),
    [itemsByLayer]
  );

  const renderItem = (item: BoardItem, key: string) => {
    const isHighlighted = highlightedItems?.has(item);
    const dimmed = highlightedItems !== null && !isHighlighted;
    const baseColor = styleFor(item.layer).color;
    const color = isHighlighted ? HIGHLIGHT_COLOR : baseColor;
    const opacity = dimmed ? 0.15 : item.kind === "zone" ? 0.4 : 1;
    const clickable = item.netId !== undefined;

    const handleClick = clickable
      ? (e: React.MouseEvent) => {
          e.stopPropagation();
          onSelectNet(item.netId === highlightedNet ? undefined : item.netId);
        }
      : undefined;

    const cursorStyle = clickable ? { cursor: "pointer" } : undefined;

    switch (item.kind) {
      case "track":
        return (
          <line
            key={key}
            x1={item.start.x}
            y1={item.start.y}
            x2={item.end.x}
            y2={item.end.y}
            stroke={color}
            strokeWidth={Math.max(item.width, 0.08)}
            strokeLinecap="round"
            opacity={opacity}
            style={cursorStyle}
            onClick={handleClick}
          />
        );
      case "via":
        return (
          <g key={key} opacity={opacity} style={cursorStyle} onClick={handleClick}>
            <circle cx={item.at.x} cy={item.at.y} r={item.size / 2} fill={color} />
            <circle cx={item.at.x} cy={item.at.y} r={item.drill / 2} fill={BOARD_FILL} />
          </g>
        );
      case "pad": {
        const transformAttr = `translate(${item.at.x} ${item.at.y}) rotate(${item.rotation})`;
        return (
          <g key={key} opacity={opacity} style={cursorStyle} onClick={handleClick}>
            {item.shape === "circle" || item.shape === "oval" ? (
              <ellipse
                cx={item.at.x}
                cy={item.at.y}
                rx={item.size.w / 2}
                ry={item.size.h / 2}
                fill={color}
                transform={`rotate(${item.rotation} ${item.at.x} ${item.at.y})`}
              />
            ) : (
              <rect
                x={-item.size.w / 2}
                y={-item.size.h / 2}
                width={item.size.w}
                height={item.size.h}
                rx={item.shape === "roundrect" ? Math.min(item.size.w, item.size.h) * 0.2 : 0}
                fill={color}
                transform={transformAttr}
              />
            )}
            {item.isThroughHole && item.drill ? (
              <circle cx={item.at.x} cy={item.at.y} r={item.drill / 2} fill={BOARD_FILL} />
            ) : null}
          </g>
        );
      }
      case "zone":
        return (
          <polygon
            key={key}
            points={item.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
            fill={color}
            fillOpacity={opacity * 0.35}
            stroke={color}
            strokeOpacity={opacity}
            strokeWidth={0.08}
            style={cursorStyle}
            onClick={handleClick}
          />
        );
      case "graphic":
        if (item.shape === "line") {
          return (
            <line
              key={key}
              x1={item.points[0].x}
              y1={item.points[0].y}
              x2={item.points[1].x}
              y2={item.points[1].y}
              stroke={color}
              strokeWidth={Math.max(item.width, 0.1)}
              opacity={opacity}
            />
          );
        }
        if (item.shape === "circle") {
          return (
            <circle
              key={key}
              cx={item.points[0].x}
              cy={item.points[0].y}
              r={item.radius}
              fill="none"
              stroke={color}
              strokeWidth={Math.max(item.width, 0.1)}
              opacity={opacity}
            />
          );
        }
        if (item.shape === "rect" || item.shape === "poly") {
          return (
            <polygon
              key={key}
              points={item.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={color}
              strokeWidth={Math.max(item.width, 0.1)}
              opacity={opacity}
            />
          );
        }
        return null;
      case "text":
        return (
          <text
            key={key}
            x={item.at.x}
            y={item.at.y}
            fontSize={item.size}
            fill={color}
            opacity={opacity}
            textAnchor="middle"
            transform={`rotate(${item.rotation} ${item.at.x} ${item.at.y})`}
            style={{ fontFamily: "monospace", userSelect: "none" }}
          >
            {item.text}
          </text>
        );
      default:
        return null;
    }
  };

  return (
    <div className="pcb-viewer">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="pcb-svg"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={() => onSelectNet(undefined)}
      >
        <rect width={VIEW_W} height={VIEW_H} fill="#0b0f17" />
        <g transform={`translate(${transform.panX} ${transform.panY}) scale(${transform.zoom})`}>
          <g transform={`translate(${offsetX} ${offsetY}) scale(${scale})`}>
            {/* Board substrate */}
            <polygon
              points={board.outline.segments.map((s) => `${s.start.x},${s.start.y}`).join(" ")}
              fill={BOARD_FILL}
              stroke="none"
            />
            {orderedLayers
              .filter((layer) => visibleLayers.has(layer))
              .map((layer) => (
                <g key={layer}>
                  {itemsByLayer.get(layer)!.map((item, i) => renderItem(item, itemKey(item, i)))}
                </g>
              ))}
          </g>
        </g>
      </svg>
      <button className="reset-view-btn" onClick={resetView} title="Reset pan & zoom">
        Reset view
      </button>
    </div>
  );
}
