import { useMemo, useState } from "react";
import { solveDiodeSeries, TYPICAL_FORWARD_DROPS, type DiodeOrientation } from "../lib/diode";

export default function DiodeCalc() {
  const [vs, setVs] = useState(5);
  const [r, setR] = useState(330);
  const [dropIdx, setDropIdx] = useState(2); // Silicon 0.7V
  const [orientation, setOrientation] = useState<DiodeOrientation>("forward");

  const result = useMemo(
    () =>
      solveDiodeSeries({
        sourceVoltage: vs,
        resistance: r,
        forwardDrop: TYPICAL_FORWARD_DROPS[dropIdx].value,
        orientation,
      }),
    [vs, r, dropIdx, orientation]
  );

  return (
    <div className="calc-page">
      <h2>Diode Circuits — Constant-Voltage-Drop Model</h2>
      <p className="calc-intro">
        Solves the standard intro-course series circuit: one source, one resistor, one diode. Uses
        the assume-ON-then-check method your course teaches for the CVD model.
      </p>

      <div className="calc-grid">
        <div className="calc-form">
          <label className="field">
            <span>Source voltage Vs (V)</span>
            <input type="number" value={vs} onChange={(e) => setVs(Number(e.target.value) || 0)} />
          </label>
          <label className="field">
            <span>Series resistance R (Ω)</span>
            <input type="number" value={r} onChange={(e) => setR(Number(e.target.value) || 1)} />
          </label>
          <label className="field">
            <span>Diode forward drop model</span>
            <select value={dropIdx} onChange={(e) => setDropIdx(Number(e.target.value))}>
              {TYPICAL_FORWARD_DROPS.map((d, i) => (
                <option key={d.label} value={i}>
                  {d.label} (Vγ = {d.value} V)
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Orientation</span>
            <select value={orientation} onChange={(e) => setOrientation(e.target.value as DiodeOrientation)}>
              <option value="forward">Forward-biased by source</option>
              <option value="reverse">Reverse-biased by source</option>
            </select>
          </label>
        </div>

        <div className="calc-results">
          <h4>
            Result: diode is <span className={result.state === "ON" ? "state-on" : "state-off"}>{result.state}</span>
          </h4>
          <table className="result-table">
            <tbody>
              <tr>
                <td>Current I</td>
                <td>{result.current.toPrecision(5)} A</td>
              </tr>
              <tr>
                <td>Voltage across diode</td>
                <td>{result.voltageAcrossDiode.toPrecision(4)} V</td>
              </tr>
              <tr>
                <td>Voltage across R</td>
                <td>{result.voltageAcrossResistor.toPrecision(4)} V</td>
              </tr>
            </tbody>
          </table>
          <h4>Worked steps</h4>
          <ol className="steps-list">
            {result.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
