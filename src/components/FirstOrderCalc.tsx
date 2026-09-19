import { useMemo, useState } from "react";
import { solveFirstOrder, settlingTime } from "../lib/firstOrder";
import LineChart from "./LineChart";

export default function FirstOrderCalc() {
  const [kind, setKind] = useState<"RC" | "RL">("RC");
  const [r, setR] = useState(1000);
  const [cOrL, setCOrL] = useState(1e-6);
  const [x0, setX0] = useState(0);
  const [xInf, setXInf] = useState(5);

  const quantityLabel = kind === "RC" ? "v_C" : "i_L";
  const quantityUnit = kind === "RC" ? "V" : "A";

  const result = useMemo(
    () =>
      solveFirstOrder({
        kind,
        r,
        cOrL,
        initialValue: x0,
        finalValue: xInf,
        quantityLabel,
        quantityUnit,
      }),
    [kind, r, cOrL, x0, xInf, quantityLabel, quantityUnit]
  );

  return (
    <div className="calc-page">
      <h2>First-Order RC/RL Circuits</h2>
      <p className="calc-intro">
        General solution form: <code>x(t) = x(∞) + [x(0) − x(∞)]·e<sup>-t/τ</sup></code> —
        works for the step response of any single-capacitor or single-inductor circuit once you've
        reduced the rest of the network to its Thevenin resistance.
      </p>

      <div className="calc-grid">
        <div className="calc-form">
          <label className="field">
            <span>Circuit type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as "RC" | "RL")}>
              <option value="RC">RC (capacitor voltage)</option>
              <option value="RL">RL (inductor current)</option>
            </select>
          </label>
          <label className="field">
            <span>Thevenin resistance R (Ω)</span>
            <input type="number" value={r} onChange={(e) => setR(Number(e.target.value) || 0)} />
          </label>
          <label className="field">
            <span>{kind === "RC" ? "Capacitance C (F)" : "Inductance L (H)"}</span>
            <input type="number" value={cOrL} onChange={(e) => setCOrL(Number(e.target.value) || 0)} step="any" />
          </label>
          <label className="field">
            <span>
              Initial value x(0) ({quantityUnit})
            </span>
            <input type="number" value={x0} onChange={(e) => setX0(Number(e.target.value) || 0)} />
          </label>
          <label className="field">
            <span>Final value x(∞) ({quantityUnit})</span>
            <input type="number" value={xInf} onChange={(e) => setXInf(Number(e.target.value) || 0)} />
          </label>
          <p className="hint">
            x(∞) is the steady-state value long after the switch flips — for RC, treat the
            capacitor as an open circuit; for RL, treat the inductor as a short.
          </p>
        </div>

        <div className="calc-results">
          <h4>Result</h4>
          <table className="result-table">
            <tbody>
              <tr>
                <td>Time constant τ</td>
                <td>{result.tau.toPrecision(4)} s {kind === "RC" ? "(τ = RC)" : "(τ = L/R)"}</td>
              </tr>
              <tr>
                <td>Settles within 2% by</td>
                <td>{settlingTime(result.tau, 0.02).toPrecision(4)} s (≈ 4τ)</td>
              </tr>
            </tbody>
          </table>
          <p className="equation-line">{result.equation}</p>
          <LineChart
            data={result.samples}
            xLabel="t (s)"
            yLabel={`${quantityLabel} (${quantityUnit})`}
          />
        </div>
      </div>
    </div>
  );
}
