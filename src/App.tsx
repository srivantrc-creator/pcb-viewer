import { useState } from "react";
import CircuitBuilder from "./components/CircuitBuilder";
import FirstOrderCalc from "./components/FirstOrderCalc";
import MagneticsCalc from "./components/MagneticsCalc";
import DiodeCalc from "./components/DiodeCalc";
import MosfetCalc from "./components/MosfetCalc";
import CourseMap from "./components/CourseMap";
import type { ToolKey } from "./lib/syllabus";
import "./App.css";

type TabKey = "map" | "builder" | "first-order" | "magnetics" | "diode" | "mosfet";

const TABS: { key: TabKey; label: string }[] = [
  { key: "map", label: "Course Map" },
  { key: "builder", label: "Circuit Builder" },
  { key: "first-order", label: "First-Order (RC/RL)" },
  { key: "magnetics", label: "Magnetics" },
  { key: "diode", label: "Diodes" },
  { key: "mosfet", label: "MOSFETs" },
];

function toolKeyToTab(tool: ToolKey): { tab: TabKey; presetIdx?: number } {
  switch (tool) {
    case "builder-dc":
      return { tab: "builder", presetIdx: 0 };
    case "builder-ac":
      return { tab: "builder", presetIdx: 5 };
    case "first-order":
      return { tab: "first-order" };
    case "magnetics":
      return { tab: "magnetics" };
    case "diode":
      return { tab: "diode" };
    case "mosfet":
      return { tab: "mosfet" };
  }
}

export default function App() {
  const [tab, setTab] = useState<TabKey>("map");
  const [builderPreset, setBuilderPreset] = useState(0);
  const [builderKey, setBuilderKey] = useState(0);

  function handleNavigate(tool: ToolKey) {
    const { tab: nextTab, presetIdx } = toolKeyToTab(tool);
    if (presetIdx !== undefined) {
      setBuilderPreset(presetIdx);
      setBuilderKey((k) => k + 1);
    }
    setTab(nextTab);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>Circuit Lab</h1>
          <span className="tagline">A study tool for ECE 20001 — Linear Circuit Analysis</span>
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
        {tab === "map" && <CourseMap onNavigate={handleNavigate} />}
        {tab === "builder" && <CircuitBuilder key={builderKey} initialPresetIdx={builderPreset} />}
        {tab === "first-order" && <FirstOrderCalc />}
        {tab === "magnetics" && <MagneticsCalc />}
        {tab === "diode" && <DiodeCalc />}
        {tab === "mosfet" && <MosfetCalc />}
      </main>
    </div>
  );
}
