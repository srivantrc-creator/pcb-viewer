import { useMemo, useState } from "react";
import type { CircuitElement, ElementType, Netlist } from "../lib/circuitTypes";
import { newId, nodeSet } from "../lib/circuitTypes";
import { solveCircuit, type SolveResult } from "../lib/mna";
import { computeThevenin, superpositionBreakdown } from "../lib/analysis";
import { mag, phaseDeg, type Complex } from "../lib/complex";
import { layoutSchematic, currentSuffix, type ElementRoute, type Pt } from "../lib/schematicLayout";
import { PRESETS } from "../lib/presets";

const TYPE_META: Record<ElementType, { label: string; unit: string; color: string }> = {
  resistor: { label: "Resistor", unit: "Ω", color: "#e8a23e" },
  vsource: { label: "Voltage source", unit: "V", color: "#4ad991" },
  isource: { label: "Current source", unit: "A", color: "#4ad9d9" },
  inductor: { label: "Inductor", unit: "H", color: "#c084fc" },
  capacitor: { label: "Capacitor", unit: "F", color: "#e85a8a" },
};

function fmtNum(n: number, digits = 4): string {
  if (!isFinite(n)) return "∞";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e5 || abs < 1e-3) return n.toExponential(digits - 2);
  return Number(n.toPrecision(digits)).toString();
}

function fmtComplex(c: Complex, isAC: boolean): string {
  if (!isAC) return `${fmtNum(c.re)}`;
  return `${fmtNum(mag(c))} ∠ ${fmtNum(phaseDeg(c), 3)}°`;
}

// ---- Schematic symbol rendering -------------------------------------------------
// Each element is drawn in its own local coordinate frame: local -x is always the
// `symbolStart` side of its route, local +x the `symbolEnd` side. A single
// translate+rotate transform places that frame on the actual (horizontal or
// vertical) wire segment, so every symbol only has to be authored once.

const SCHEM_BG = "#0c1420";
const WIRE_COLOR = "#5b6b85";
const SYMBOL_HALF = 22;

function dist(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
function midpoint(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function angleDeg(a: Pt, b: Pt): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}
function unitVec(a: Pt, b: Pt): Pt {
  const d = dist(a, b) || 1;
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
}

function resistorZigzagPath(h: number): string {
  const amp = 9;
  const pts: [number, number][] = [
    [-h, 0],
    [-h * 0.6, -amp],
    [-h * 0.2, amp],
    [h * 0.2, -amp],
    [h * 0.6, amp],
    [h, 0],
  ];
  return "M " + pts.map((p) => p.join(" ")).join(" L ");
}

function inductorCoilPath(h: number): string {
  const n = 4;
  const step = (2 * h) / n;
  let d = `M ${-h} 0`;
  for (let i = 0; i < n; i++) {
    const x1 = -h + (i + 1) * step;
    const r = step / 2;
    d += ` A ${r} ${r} 0 0 1 ${x1} 0`;
  }
  return d;
}

/** Renders one element's symbol body in its local (-h..h along x) coordinate frame. */
function ElementSymbolBody({
  el,
  color,
  h,
  positiveAtStart,
}: {
  el: CircuitElement;
  color: string;
  h: number;
  positiveAtStart: boolean;
}) {
  switch (el.type) {
    case "resistor":
      return (
        <>
          <rect x={-h - 3} y={-13} width={2 * h + 6} height={26} fill={SCHEM_BG} />
          <path d={resistorZigzagPath(h)} stroke={color} strokeWidth={2.25} fill="none" strokeLinejoin="round" />
        </>
      );
    case "inductor":
      return (
        <>
          <rect x={-h - 3} y={-13} width={2 * h + 6} height={26} fill={SCHEM_BG} />
          <path d={inductorCoilPath(h)} stroke={color} strokeWidth={2.25} fill="none" />
        </>
      );
    case "capacitor": {
      const gap = 6;
      return (
        <>
          <rect x={-h - 3} y={-16} width={2 * h + 6} height={32} fill={SCHEM_BG} />
          <line x1={-gap} y1={-13} x2={-gap} y2={13} stroke={color} strokeWidth={2.5} />
          <line x1={gap} y1={-13} x2={gap} y2={13} stroke={color} strokeWidth={2.5} />
        </>
      );
    }
    case "vsource": {
      const r = Math.min(h, 20);
      const plusX = (positiveAtStart ? -1 : 1) * r * 0.48;
      const minusX = -plusX;
      return (
        <>
          <rect x={-r - 3} y={-r - 3} width={2 * r + 6} height={2 * r + 6} fill={SCHEM_BG} />
          <circle cx={0} cy={0} r={r} fill={SCHEM_BG} stroke={color} strokeWidth={2.25} />
          <line x1={plusX - 4} y1={0} x2={plusX + 4} y2={0} stroke={color} strokeWidth={1.75} />
          <line x1={plusX} y1={-4} x2={plusX} y2={4} stroke={color} strokeWidth={1.75} />
          {/* Drawn along local y (not x) so it stays visible across the wire, not parallel to it, once rotated. */}
          <line x1={minusX} y1={-4} x2={minusX} y2={4} stroke={color} strokeWidth={1.75} />
        </>
      );
    }
    case "isource": {
      const r = Math.min(h, 20);
      return (
        <>
          <rect x={-r - 3} y={-r - 3} width={2 * r + 6} height={2 * r + 6} fill={SCHEM_BG} />
          <circle cx={0} cy={0} r={r} fill={SCHEM_BG} stroke={color} strokeWidth={2.25} />
          <g transform={positiveAtStart ? undefined : "rotate(180)"}>
            <line x1={-r * 0.55} y1={0} x2={r * 0.5} y2={0} stroke={color} strokeWidth={2} />
            <path
              d={`M ${r * 0.5 - 6} ${-5} L ${r * 0.5} 0 L ${r * 0.5 - 6} 5`}
              stroke={color}
              strokeWidth={2}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        </>
      );
    }
    default:
      return null;
  }
}

/** Full render for one element: wire polyline, symbol, name/value labels, and a
 * reference-direction current arrow + label (I with the element's suffix). */
function SchematicElement({
  route,
  color,
  unit,
  currentVal,
  currentLabel,
  isAC,
}: {
  route: ElementRoute;
  color: string;
  unit: string;
  currentVal: Complex | undefined;
  currentLabel: string;
  isAC: boolean;
}) {
  const { element: el, path, symbolStart, symbolEnd, orientation, positiveAtStart } = route;
  const center = midpoint(symbolStart, symbolEnd);
  const segLen = dist(symbolStart, symbolEnd);
  const h = Math.max(9, Math.min(SYMBOL_HALF, segLen / 2 - 6));
  const angle = angleDeg(symbolStart, symbolEnd);

  // How far the symbol's body actually sticks out perpendicular to the wire —
  // used so the name/value labels clear it regardless of orientation.
  const lateralHalf =
    el.type === "vsource" || el.type === "isource" ? Math.min(h, 20) + 3 : el.type === "capacitor" ? 16 : 13;

  const perp: Pt = orientation === "h" ? { x: 0, y: -1 } : { x: 1, y: 0 };
  const labelOffset = lateralHalf + 13;
  const valueOffset = lateralHalf + 24;
  const labelPos = { x: center.x + perp.x * labelOffset, y: center.y + perp.y * labelOffset - (orientation === "h" ? 3 : 0) };
  const valuePos = { x: center.x - perp.x * valueOffset, y: center.y - perp.y * valueOffset + (orientation === "h" ? 3 : 0) };

  const dirRaw = unitVec(symbolStart, symbolEnd);
  const dirCurrent = positiveAtStart ? dirRaw : { x: -dirRaw.x, y: -dirRaw.y };
  const arrowReach = Math.min(segLen / 2 - 6, h + 34);
  const arrowBase = { x: center.x - dirCurrent.x * (arrowReach - 12), y: center.y - dirCurrent.y * (arrowReach - 12) };
  const arrowTip = { x: center.x + dirCurrent.x * arrowReach, y: center.y + dirCurrent.y * arrowReach };
  const arrowLabelPos = {
    x: arrowTip.x + perp.x * 13 - dirCurrent.x * 2,
    y: arrowTip.y + perp.y * 13 - dirCurrent.x * 2,
  };
  const showArrow = arrowReach > h + 10;

  return (
    <g>
      <polyline points={path.map((p) => `${p.x},${p.y}`).join(" ")} stroke={WIRE_COLOR} strokeWidth={2} fill="none" />
      <g transform={`translate(${center.x} ${center.y}) rotate(${angle})`}>
        <ElementSymbolBody el={el} color={color} h={h} positiveAtStart={positiveAtStart} />
      </g>
      <text x={labelPos.x} y={labelPos.y} textAnchor="middle" fontSize={13} fontWeight={600} fill={color} fontFamily="'JetBrains Mono', monospace">
        {el.label}
      </text>
      <text x={valuePos.x} y={valuePos.y} textAnchor="middle" fontSize={10.5} fill="#8b96a8" fontFamily="'JetBrains Mono', monospace">
        {fmtNum(el.value)}
        {unit}
      </text>
      {showArrow && (
        <g>
          {currentVal && <title>{`I${currentLabel} = ${fmtComplex(currentVal, isAC)} A (reference direction shown)`}</title>}
          <line x1={arrowBase.x} y1={arrowBase.y} x2={arrowTip.x} y2={arrowTip.y} stroke="#5b8fd6" strokeWidth={1.6} />
          <path
            d={`M ${arrowTip.x - dirCurrent.x * 7 - perp.x * 4} ${arrowTip.y - dirCurrent.y * 7 - perp.y * 4} L ${arrowTip.x} ${arrowTip.y} L ${
              arrowTip.x - dirCurrent.x * 7 + perp.x * 4
            } ${arrowTip.y - dirCurrent.y * 7 + perp.y * 4}`}
            stroke="#5b8fd6"
            strokeWidth={1.6}
            fill="none"
            strokeLinejoin="round"
          />
          <text
            x={arrowLabelPos.x}
            y={arrowLabelPos.y}
            textAnchor="middle"
            fontSize={10.5}
            fill="#7ea6e0"
            fontFamily="'JetBrains Mono', monospace"
          >
            I{currentLabel}
          </text>
        </g>
      )}
    </g>
  );
}

function GroundSymbol({ x, y }: { x: number; y: number }) {
  return (
    <g stroke="#8b96a8" strokeWidth={2}>
      <line x1={x} y1={y} x2={x} y2={y + 9} />
      <line x1={x - 13} y1={y + 9} x2={x + 13} y2={y + 9} />
      <line x1={x - 8} y1={y + 15} x2={x + 8} y2={y + 15} />
      <line x1={x - 3} y1={y + 21} x2={x + 3} y2={y + 21} />
    </g>
  );
}

function defaultElement(type: ElementType, existing: CircuitElement[]): CircuitElement {
  const countOfType = existing.filter((e) => e.type === type).length + 1;
  const prefix = { resistor: "R", vsource: "V", isource: "I", inductor: "L", capacitor: "C" }[type];
  const defaults: Record<ElementType, number> = {
    resistor: 1000,
    vsource: 5,
    isource: 0.01,
    inductor: 0.01,
    capacitor: 1e-6,
  };
  return {
    id: newId(),
    type,
    label: `${prefix}${countOfType}`,
    nodeA: 1,
    nodeB: 0,
    value: defaults[type],
    phaseDeg: 0,
  };
}

interface CircuitBuilderProps {
  initialPresetIdx?: number;
}

export default function CircuitBuilder({ initialPresetIdx = 0 }: CircuitBuilderProps) {
  const [elements, setElements] = useState<CircuitElement[]>(PRESETS[initialPresetIdx].elements);
  const [mode, setMode] = useState<"DC" | "AC">(PRESETS[initialPresetIdx].mode);
  const [freqHz, setFreqHz] = useState(PRESETS[initialPresetIdx].freqHz ?? 1000);
  const [presetIdx, setPresetIdx] = useState(initialPresetIdx);
  const [activeTool, setActiveTool] = useState<"results" | "thevenin" | "superposition">("results");
  const [theveninP, setTheveninP] = useState<number | null>(null);
  const [theveninN, setTheveninN] = useState<number | null>(0);
  const [superTarget, setSuperTarget] = useState<number | null>(null);

  const netlist: Netlist = useMemo(() => ({ elements, groundNode: 0 }), [elements]);
  const omega = mode === "AC" ? 2 * Math.PI * freqHz : 0;
  const isAC = mode === "AC";

  const result: SolveResult = useMemo(() => solveCircuit(netlist, omega), [netlist, omega]);
  const nodes = useMemo(() => nodeSet(netlist), [netlist]);
  const schematic = useMemo(() => layoutSchematic(netlist), [netlist]);
  const nodeDegree = useMemo(() => {
    const deg = new Map<number, number>();
    for (const el of elements) {
      if (el.nodeA !== 0) deg.set(el.nodeA, (deg.get(el.nodeA) ?? 0) + 1);
      if (el.nodeB !== 0) deg.set(el.nodeB, (deg.get(el.nodeB) ?? 0) + 1);
    }
    return deg;
  }, [elements]);

  // Short current-arrow labels (Ra -> "a", giving "Ia"). Falls back to the
  // element's full label when two elements would otherwise collide (e.g.
  // "R1" and "L1" both suffix to "1").
  const currentLabels = useMemo(() => {
    const counts = new Map<string, number>();
    for (const el of elements) {
      const suf = currentSuffix(el.label);
      counts.set(suf, (counts.get(suf) ?? 0) + 1);
    }
    const map = new Map<string, string>();
    for (const el of elements) {
      const suf = currentSuffix(el.label);
      map.set(el.id, (counts.get(suf) ?? 0) > 1 ? el.label : suf);
    }
    return map;
  }, [elements]);

  const theveninResult = useMemo(() => {
    if (theveninP === null || theveninN === null || theveninP === theveninN) return null;
    return computeThevenin(netlist, theveninP, theveninN, omega);
  }, [netlist, theveninP, theveninN, omega]);

  const superResult = useMemo(() => {
    if (superTarget === null) return null;
    return superpositionBreakdown(netlist, superTarget, omega);
  }, [netlist, superTarget, omega]);

  function updateElement(id: string, patch: Partial<CircuitElement>) {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...patch } : el)));
  }
  function removeElement(id: string) {
    setElements((prev) => prev.filter((el) => el.id !== id));
  }
  function addElement(type: ElementType) {
    setElements((prev) => [...prev, defaultElement(type, prev)]);
  }
  function loadPreset(idx: number) {
    setPresetIdx(idx);
    const preset = PRESETS[idx];
    setElements(preset.elements.map((e) => ({ ...e })));
    setMode(preset.mode);
    if (preset.freqHz) setFreqHz(preset.freqHz);
    setTheveninP(null);
    setTheveninN(0);
    setSuperTarget(null);
  }

  function power(el: CircuitElement): number {
    const v = result.nodeVoltages.get(el.nodeA);
    const vb = result.nodeVoltages.get(el.nodeB);
    const i = result.elementCurrents.get(el.id);
    if (!v || !vb || !i) return 0;
    const vAcrossRe = v.re - vb.re;
    const vAcrossIm = v.im - vb.im;
    // Average power = (1/2) Re(V * conj(I)) for AC phasors; for DC it's just V*I.
    const raw = vAcrossRe * i.re + vAcrossIm * i.im;
    return isAC ? raw / 2 : raw;
  }

  return (
    <div className="builder">
      <div className="builder-toolbar">
        <label className="field">
          <span>Preset</span>
          <select value={presetIdx} onChange={(e) => loadPreset(Number(e.target.value))}>
            {PRESETS.map((p, i) => (
              <option key={p.name} value={i}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Mode</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as "DC" | "AC")}>
            <option value="DC">DC</option>
            <option value="AC">AC / phasor</option>
          </select>
        </label>
        {isAC && (
          <label className="field">
            <span>Frequency (Hz)</span>
            <input
              type="number"
              value={freqHz}
              onChange={(e) => setFreqHz(Number(e.target.value) || 0)}
            />
          </label>
        )}
        <p className="preset-desc">{PRESETS[presetIdx]?.description}</p>
      </div>

      <div className="builder-grid">
        <div className="element-editor">
          <h3>Elements</h3>
          <div className="add-buttons">
            {(Object.keys(TYPE_META) as ElementType[]).map((t) => (
              <button key={t} onClick={() => addElement(t)} style={{ borderColor: TYPE_META[t].color }}>
                + {TYPE_META[t].label}
              </button>
            ))}
          </div>
          <table className="element-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Type</th>
                <th>Node A</th>
                <th>Node B</th>
                <th>Value</th>
                {isAC && <th>Phase°</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {elements.map((el) => (
                <tr key={el.id}>
                  <td>
                    <input
                      className="cell-input label-input"
                      value={el.label}
                      onChange={(e) => updateElement(el.id, { label: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={el.type}
                      onChange={(e) => updateElement(el.id, { type: e.target.value as ElementType })}
                    >
                      {(Object.keys(TYPE_META) as ElementType[]).map((t) => (
                        <option key={t} value={t}>
                          {TYPE_META[t].label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="cell-input node-input"
                      type="number"
                      value={el.nodeA}
                      onChange={(e) => updateElement(el.id, { nodeA: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input node-input"
                      type="number"
                      value={el.nodeB}
                      onChange={(e) => updateElement(el.id, { nodeB: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <div className="value-cell">
                      <input
                        className="cell-input value-input"
                        type="number"
                        value={el.value}
                        onChange={(e) => updateElement(el.id, { value: Number(e.target.value) })}
                      />
                      <span className="unit">{TYPE_META[el.type].unit}</span>
                    </div>
                  </td>
                  {isAC && (
                    <td>
                      {(el.type === "vsource" || el.type === "isource") && (
                        <input
                          className="cell-input node-input"
                          type="number"
                          value={el.phaseDeg ?? 0}
                          onChange={(e) => updateElement(el.id, { phaseDeg: Number(e.target.value) })}
                        />
                      )}
                    </td>
                  )}
                  <td>
                    <button className="remove-btn" onClick={() => removeElement(el.id)} title="Remove">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">Node 0 is always ground. Give any two elements the same node number to connect them.</p>
        </div>

        <div className="schematic-panel">
          <h3>Schematic</h3>
          <svg
            viewBox={`0 0 ${Math.max(schematic.width, 320)} ${Math.max(schematic.height, 260)}`}
            className="schematic-svg"
          >
            <rect width={Math.max(schematic.width, 320)} height={Math.max(schematic.height, 260)} fill={SCHEM_BG} />
            {schematic.groundXRange && schematic.groundY !== null && (
              <line
                x1={schematic.groundXRange[0]}
                y1={schematic.groundY}
                x2={schematic.groundXRange[1]}
                y2={schematic.groundY}
                stroke={WIRE_COLOR}
                strokeWidth={2}
              />
            )}
            {schematic.routes.map((route) => (
              <SchematicElement
                key={route.element.id}
                route={route}
                color={TYPE_META[route.element.type].color}
                unit={TYPE_META[route.element.type].unit}
                currentVal={result.elementCurrents.get(route.element.id)}
                currentLabel={currentLabels.get(route.element.id) ?? route.element.label}
                isAC={isAC}
              />
            ))}
            {[...schematic.nodePos.entries()]
              .filter(([n]) => (nodeDegree.get(n) ?? 0) >= 3)
              .map(([n, p]) => (
                <circle key={n} cx={p.x} cy={p.y} r={3.5} fill="#e6e8ee" />
              ))}
            {schematic.groundSymbolX !== null && schematic.groundY !== null && (
              <GroundSymbol x={schematic.groundSymbolX} y={schematic.groundY} />
            )}
          </svg>
          {result.error && <p className="error-text">{result.error}</p>}
        </div>
      </div>

      <div className="analysis-tabs">
        <button className={activeTool === "results" ? "active" : ""} onClick={() => setActiveTool("results")}>
          Node/Element Results
        </button>
        <button className={activeTool === "thevenin" ? "active" : ""} onClick={() => setActiveTool("thevenin")}>
          Thevenin / Norton
        </button>
        <button className={activeTool === "superposition" ? "active" : ""} onClick={() => setActiveTool("superposition")}>
          Superposition
        </button>
      </div>

      {activeTool === "results" && !result.error && (
        <div className="results-panel">
          <div className="results-col">
            <h4>Node voltages</h4>
            <table className="result-table">
              <thead>
                <tr>
                  <th>Node</th>
                  <th>{isAC ? "V (mag ∠ phase)" : "V (DC)"}</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((n) => (
                  <tr key={n}>
                    <td>{n === 0 ? "GND (0)" : n}</td>
                    <td>{fmtComplex(result.nodeVoltages.get(n) ?? { re: 0, im: 0 }, isAC)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="results-col">
            <h4>Element currents &amp; power</h4>
            <table className="result-table">
              <thead>
                <tr>
                  <th>Element</th>
                  <th>I (A⮕B)</th>
                  <th>P (W)</th>
                </tr>
              </thead>
              <tbody>
                {elements.map((el) => (
                  <tr key={el.id}>
                    <td>{el.label}</td>
                    <td>{fmtComplex(result.elementCurrents.get(el.id) ?? { re: 0, im: 0 }, isAC)}</td>
                    <td>{fmtNum(power(el))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hint">
              Power is per-element (V<sub>A</sub>−V<sub>B</sub>)×I. {isAC && "Averaged over one cycle for AC."} Positive = absorbing power (a load); negative = delivering it (a source).
            </p>
          </div>
        </div>
      )}

      {activeTool === "thevenin" && (
        <div className="results-panel">
          <div className="results-col">
            <h4>Thevenin / Norton equivalent</h4>
            <p className="hint">Pick the two "port" nodes you'd connect a load between (don't include the load itself in the netlist above).</p>
            <div className="port-selectors">
              <label className="field">
                <span>Node + (P)</span>
                <select value={theveninP ?? ""} onChange={(e) => setTheveninP(e.target.value === "" ? null : Number(e.target.value))}>
                  <option value="">Select…</option>
                  {nodes.map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "GND (0)" : n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Node − (N)</span>
                <select value={theveninN ?? ""} onChange={(e) => setTheveninN(e.target.value === "" ? null : Number(e.target.value))}>
                  <option value="">Select…</option>
                  {nodes.map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "GND (0)" : n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {theveninResult && !theveninResult.error && (
              <table className="result-table">
                <tbody>
                  <tr>
                    <td>V<sub>th</sub> (open-circuit voltage)</td>
                    <td>{fmtComplex(theveninResult.vth, isAC)} V</td>
                  </tr>
                  <tr>
                    <td>{isAC ? "Z" : "R"}<sub>th</sub></td>
                    <td>{fmtComplex(theveninResult.zth, isAC)} Ω</td>
                  </tr>
                  <tr>
                    <td>I<sub>N</sub> (Norton current)</td>
                    <td>{fmtComplex(theveninResult.inNorton, isAC)} A</td>
                  </tr>
                </tbody>
              </table>
            )}
            {theveninResult?.error && <p className="error-text">{theveninResult.error}</p>}
          </div>
        </div>
      )}

      {activeTool === "superposition" && (
        <div className="results-panel">
          <div className="results-col">
            <h4>Superposition breakdown</h4>
            <p className="hint">Pick a node — see each independent source's individual contribution to its voltage, with everything else zeroed (V-sources shorted, I-sources opened).</p>
            <label className="field">
              <span>Target node</span>
              <select value={superTarget ?? ""} onChange={(e) => setSuperTarget(e.target.value === "" ? null : Number(e.target.value))}>
                <option value="">Select…</option>
                {nodes
                  .filter((n) => n !== 0)
                  .map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
              </select>
            </label>
            {superResult && !superResult.error && (
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Contribution to V(node)</th>
                  </tr>
                </thead>
                <tbody>
                  {superResult.rows.map((r) => (
                    <tr key={r.sourceId}>
                      <td>{r.sourceLabel} acting alone</td>
                      <td>{fmtComplex(r.contribution, isAC)} V</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td>Sum of contributions</td>
                    <td>{fmtComplex(superResult.total, isAC)} V</td>
                  </tr>
                  <tr>
                    <td>Full-circuit solve (check)</td>
                    <td>{fmtComplex(superResult.fullSolve, isAC)} V</td>
                  </tr>
                </tbody>
              </table>
            )}
            {superResult?.error && <p className="error-text">{superResult.error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
