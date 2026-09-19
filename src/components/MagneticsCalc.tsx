import { useMemo, useState } from "react";
import { analyzeCoupling, analyzeIdealTransformer } from "../lib/magnetics";

export default function MagneticsCalc() {
  const [l1, setL1] = useState(0.02);
  const [l2, setL2] = useState(0.08);
  const [m, setM] = useState(0.03);

  const [n1, setN1] = useState(100);
  const [n2, setN2] = useState(400);
  const [v1, setV1] = useState(120);
  const [zLoad, setZLoad] = useState(50);

  const coupling = useMemo(() => analyzeCoupling({ l1, l2, m }), [l1, l2, m]);
  const transformer = useMemo(
    () => analyzeIdealTransformer({ n1, n2, primaryVoltage: v1, secondaryLoadZ: zLoad }),
    [n1, n2, v1, zLoad]
  );

  return (
    <div className="calc-page">
      <h2>Magnetically Coupled Circuits &amp; Transformers (week 11)</h2>

      <div className="calc-grid">
        <div className="calc-form">
          <h4>Coupling coefficient</h4>
          <label className="field">
            <span>L₁ (H)</span>
            <input type="number" value={l1} onChange={(e) => setL1(Number(e.target.value) || 0)} step="any" />
          </label>
          <label className="field">
            <span>L₂ (H)</span>
            <input type="number" value={l2} onChange={(e) => setL2(Number(e.target.value) || 0)} step="any" />
          </label>
          <label className="field">
            <span>M (H)</span>
            <input type="number" value={m} onChange={(e) => setM(Number(e.target.value) || 0)} step="any" />
          </label>
        </div>
        <div className="calc-results">
          <h4>Result</h4>
          <table className="result-table">
            <tbody>
              <tr>
                <td>k = M / √(L₁L₂)</td>
                <td>{coupling.k.toFixed(4)}</td>
              </tr>
              <tr>
                <td>Max possible M (k=1)</td>
                <td>{coupling.maxM.toPrecision(4)} H</td>
              </tr>
              <tr>
                <td>Classification</td>
                <td>{coupling.classification}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="calc-grid" style={{ marginTop: 28 }}>
        <div className="calc-form">
          <h4>Ideal transformer</h4>
          <label className="field">
            <span>N₁ (primary turns)</span>
            <input type="number" value={n1} onChange={(e) => setN1(Number(e.target.value) || 0)} />
          </label>
          <label className="field">
            <span>N₂ (secondary turns)</span>
            <input type="number" value={n2} onChange={(e) => setN2(Number(e.target.value) || 0)} />
          </label>
          <label className="field">
            <span>Primary voltage V₁ (V)</span>
            <input type="number" value={v1} onChange={(e) => setV1(Number(e.target.value) || 0)} />
          </label>
          <label className="field">
            <span>Secondary load Z (Ω)</span>
            <input type="number" value={zLoad} onChange={(e) => setZLoad(Number(e.target.value) || 0)} />
          </label>
        </div>
        <div className="calc-results">
          <h4>Result</h4>
          <table className="result-table">
            <tbody>
              <tr>
                <td>Turns ratio a = N₁/N₂</td>
                <td>{transformer.turnsRatio.toFixed(4)}</td>
              </tr>
              <tr>
                <td>V₂ = V₁ / a</td>
                <td>{transformer.secondaryVoltage?.toPrecision(4)} V</td>
              </tr>
              <tr>
                <td>Reflected impedance Z₁' = a²·Z₂</td>
                <td>{transformer.reflectedImpedance?.toPrecision(4)} Ω (as seen from the primary)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
