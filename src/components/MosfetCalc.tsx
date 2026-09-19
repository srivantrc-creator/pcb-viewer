import { useMemo, useState } from "react";
import { analyzeMosfetBias, commonSourceGain } from "../lib/mosfet";

export default function MosfetCalc() {
  const [vgs, setVgs] = useState(2.5);
  const [vds, setVds] = useState(3);
  const [vtn, setVtn] = useState(1);
  const [kn, setKn] = useState(0.002);
  const [lambda, setLambda] = useState(0);

  const [rd, setRd] = useState(2000);
  const [rs, setRs] = useState(0);

  const bias = useMemo(() => analyzeMosfetBias({ vgs, vds, vtn, kn, lambda }), [vgs, vds, vtn, kn, lambda]);
  const gainResult = useMemo(
    () => commonSourceGain({ gm: bias.gm, ro: bias.ro, rd, rs }),
    [bias.gm, bias.ro, rd, rs]
  );

  return (
    <div className="calc-page">
      <h2>MOSFET Bias Point &amp; Common-Source Gain</h2>
      <p className="calc-intro">
        Square-law NMOS model: cutoff when V<sub>OV</sub> ≤ 0, triode when V<sub>DS</sub> &lt; V<sub>OV</sub>,
        saturation otherwise. Amplifier gain formulas assume the transistor is biased in saturation.
      </p>

      <div className="calc-grid">
        <div className="calc-form">
          <h4>Bias point</h4>
          <label className="field">
            <span>V<sub>GS</sub> (V)</span>
            <input type="number" value={vgs} onChange={(e) => setVgs(Number(e.target.value) || 0)} />
          </label>
          <label className="field">
            <span>V<sub>DS</sub> (V)</span>
            <input type="number" value={vds} onChange={(e) => setVds(Number(e.target.value) || 0)} />
          </label>
          <label className="field">
            <span>V<sub>tn</sub> — threshold (V)</span>
            <input type="number" value={vtn} onChange={(e) => setVtn(Number(e.target.value) || 0)} />
          </label>
          <label className="field">
            <span>k<sub>n</sub> = k<sub>n</sub>'·(W/L) (A/V²)</span>
            <input type="number" value={kn} onChange={(e) => setKn(Number(e.target.value) || 0)} step="any" />
          </label>
          <label className="field">
            <span>λ — channel-length modulation (1/V, 0 to ignore)</span>
            <input type="number" value={lambda} onChange={(e) => setLambda(Number(e.target.value) || 0)} step="any" />
          </label>
        </div>

        <div className="calc-results">
          <h4>
            Region: <span className="state-on">{bias.region.toUpperCase()}</span>
          </h4>
          <table className="result-table">
            <tbody>
              <tr>
                <td>V<sub>OV</sub></td>
                <td>{bias.vov.toPrecision(4)} V</td>
              </tr>
              <tr>
                <td>I<sub>D</sub></td>
                <td>{(bias.id * 1000).toPrecision(4)} mA</td>
              </tr>
              <tr>
                <td>g<sub>m</sub></td>
                <td>{(bias.gm * 1000).toPrecision(4)} mA/V</td>
              </tr>
              <tr>
                <td>r<sub>o</sub></td>
                <td>{isFinite(bias.ro) ? `${bias.ro.toPrecision(4)} Ω` : "∞"}</td>
              </tr>
            </tbody>
          </table>
          <ol className="steps-list">
            {bias.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      </div>

      <div className="calc-grid" style={{ marginTop: 28 }}>
        <div className="calc-form">
          <h4>Common-source amplifier gain</h4>
          <label className="field">
            <span>R<sub>D</sub> (Ω)</span>
            <input type="number" value={rd} onChange={(e) => setRd(Number(e.target.value) || 0)} />
          </label>
          <label className="field">
            <span>R<sub>S</sub> (Ω, 0 = bypassed)</span>
            <input type="number" value={rs} onChange={(e) => setRs(Number(e.target.value) || 0)} />
          </label>
          <p className="hint">
            Uses g<sub>m</sub> and r<sub>o</sub> from the bias point above — the transistor needs to be in
            saturation for these formulas to mean anything.
          </p>
        </div>
        <div className="calc-results">
          <h4>Result</h4>
          {bias.region !== "saturation" ? (
            <p className="error-text">
              Transistor isn't in saturation at this bias point — gain formulas don't apply. Adjust V<sub>GS</sub>/V<sub>DS</sub> above.
            </p>
          ) : (
            <>
              <table className="result-table">
                <tbody>
                  <tr>
                    <td>Voltage gain A<sub>v</sub> = v<sub>out</sub>/v<sub>in</sub></td>
                    <td>{gainResult.gain.toPrecision(4)} V/V</td>
                  </tr>
                </tbody>
              </table>
              <ol className="steps-list">
                {gainResult.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
