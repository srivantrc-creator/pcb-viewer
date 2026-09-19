import { useState } from "react";
import CircuitBuilder from "./components/CircuitBuilder";
import FirstOrderCalc from "./components/FirstOrderCalc";
import MagneticsCalc from "./components/MagneticsCalc";
import DiodeCalc from "./components/DiodeCalc";
import MosfetCalc from "./components/MosfetCalc";
import "./App.css";

type TabKey = "builder" | "first-order" | "magnetics" | "diode" | "mosfet";

const TABS: { key: TabKey; label: string }[] = [
  { key: "builder", label: "Circuit Builder" },
  { key: "first-order", label: "First-Order (RC/RL)" },
  { key: "magnetics", label: "Magnetics" },
  { key: "diode", label: "Diodes" },
  { key: "mosfet", label: "MOSFETs" },
];

export default function App() {
  const [tab, setTab] = useState<TabKey>("builder");

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M4 12h2.4l1.6-4 2.4 8 2.4-8 1.6 4H20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h1>Chalem Circuit Lab</h1>
        </div>
        <nav className="tab-nav">
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="app-main">
        {tab === "builder" && <CircuitBuilder />}
        {tab === "first-order" && <FirstOrderCalc />}
        {tab === "magnetics" && <MagneticsCalc />}
        {tab === "diode" && <DiodeCalc />}
        {tab === "mosfet" && <MosfetCalc />}
      </main>
    </div>
  );
}
