import { useMemo, useState } from "react";
import type { CircuitElement, ElementType, Netlist } from "../lib/circuitTypes";
import { newId, nodeSet } from "../lib/circuitTypes";
import { solveCircuit, type SolveResult } from "../lib/mna";
import { computeThevenin, superpositionBreakdown } from "../lib/analysis";
import { mag, phaseDeg, type Complex } from "../lib/complex";
import { layoutNodes } from "../lib/layout";
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
  const positions = useMemo(() => layoutNodes(nodes), [nodes]);

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
          <svg viewBox="0 0 640 420" className="schematic-svg">
            <rect width={640} height={420} fill="#0b0f17" />
            {elements.map((el) => {
              const a = positions.get(el.nodeA);
              const b = positions.get(el.nodeB);
              if (!a || !b) return null;
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2;
              const meta = TYPE_META[el.type];
              const current = result.elementCurrents.get(el.id);
              return (
                <g key={el.id}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#3a4356" strokeWidth={2} />
                  <circle cx={mx} cy={my} r={16} fill="#141b28" stroke={meta.color} strokeWidth={2} />
                  <text x={mx} y={my - 22} textAnchor="middle" fontSize={12} fill={meta.color} fontFamily="monospace">
                    {el.label}
                  </text>
                  <text x={mx} y={my + 34} textAnchor="middle" fontSize={10.5} fill="#8a95a8" fontFamily="monospace">
                    {fmtNum(el.value)}
                    {meta.unit}
                  </text>
                  {current && (
                    <text x={mx} y={my + 47} textAnchor="middle" fontSize={9.5} fill="#5b7a99" fontFamily="monospace">
                      I={fmtComplex(current, isAC)}A
                    </text>
                  )}
                </g>
              );
            })}
            {nodes.map((n) => {
              const p = positions.get(n);
              if (!p) return null;
              const v = result.nodeVoltages.get(n);
              return (
                <g key={n}>
                  <circle cx={p.x} cy={p.y} r={n === 0 ? 8 : 6} fill={n === 0 ? "#5b7a99" : "#e6e8ee"} />
                  <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize={11} fill="#cfd6e2" fontFamily="monospace">
                    {n === 0 ? "GND" : `n${n}`}
                  </text>
                  {n !== 0 && v && (
                    <text x={p.x} y={p.y + 22} textAnchor="middle" fontSize={10.5} fill="#7ee0a8" fontFamily="monospace">
                      {fmtComplex(v, isAC)}V
                    </text>
                  )}
                </g>
              );
            })}
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
