import { useCallback, useMemo, useRef, useState } from "react";
import PcbViewer from "./components/PcbViewer";
import LayerToggles from "./components/LayerToggles";
import NetPanel from "./components/NetPanel";
import { parseKicadPcb } from "./lib/kicadParser";
import { buildNetIndex } from "./lib/netUtils";
import { LAYER_STYLES } from "./lib/layerStyle";
import type { PcbBoard } from "./lib/types";
import "./App.css";

const defaultVisibleLayers = new Set(
  LAYER_STYLES.filter((l) => l.defaultVisible).map((l) => l.id)
);

export default function App() {
  const [board, setBoard] = useState<PcbBoard | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(defaultVisibleLayers);
  const [highlightedNet, setHighlightedNet] = useState<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const netIndex = useMemo(() => (board ? buildNetIndex(board) : new Map()), [board]);

  const presentLayers = useMemo(() => {
    const set = new Set<string>();
    board?.items.forEach((item) => set.add(item.layer));
    return set;
  }, [board]);

  const loadFromText = useCallback((text: string, name: string) => {
    try {
      const parsed = parseKicadPcb(text);
      setBoard(parsed);
      setFileName(name);
      setError(null);
      setHighlightedNet(undefined);
      setVisibleLayers(new Set(defaultVisibleLayers));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse this file.");
    }
  }, []);

  const loadSample = useCallback(() => {
    setLoading(true);
    fetch("/sample-board.kicad_pcb")
      .then((res) => res.text())
      .then((text) => loadFromText(text, "sample-board.kicad_pcb"))
      .catch(() => setError("Couldn't load the sample board."))
      .finally(() => setLoading(false));
  }, [loadFromText]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => loadFromText(String(reader.result ?? ""), file.name);
      reader.onerror = () => setError("Couldn't read that file.");
      reader.readAsText(file);
      e.target.value = "";
    },
    [loadFromText]
  );

  const toggleLayer = useCallback((layer: string) => {
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>PCB Viewer</h1>
          <span className="tagline">Interactive KiCad layout &amp; net explorer</span>
        </div>
        <div className="header-actions">
          <button onClick={loadSample} disabled={loading}>
            Load sample board
          </button>
          <button onClick={() => fileInputRef.current?.click()}>Upload .kicad_pcb</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".kicad_pcb"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {!board ? (
        <div className="empty-state">
          <p>Load the sample board or upload your own KiCad PCB export (.kicad_pcb) to get started.</p>
        </div>
      ) : (
        <div className="workspace">
          <aside className="sidebar left">
            <div className="file-info">
              <strong>{fileName}</strong>
              <span>{board.footprints.length} footprints</span>
            </div>
            <LayerToggles
              visibleLayers={visibleLayers}
              onToggle={toggleLayer}
              presentLayers={presentLayers}
            />
          </aside>

          <main className="viewer-area">
            <PcbViewer
              board={board}
              visibleLayers={visibleLayers}
              highlightedNet={highlightedNet}
              netIndex={netIndex}
              onSelectNet={setHighlightedNet}
            />
          </main>

          <aside className="sidebar right">
            <NetPanel
              board={board}
              netIndex={netIndex}
              highlightedNet={highlightedNet}
              onSelectNet={setHighlightedNet}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
