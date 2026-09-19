import type { PcbBoard, BoardItem } from "../lib/types";
import { rankedNets } from "../lib/netUtils";

interface NetPanelProps {
  board: PcbBoard;
  netIndex: Map<number, BoardItem[]>;
  highlightedNet: number | undefined;
  onSelectNet: (netId: number | undefined) => void;
}

export default function NetPanel({ board, netIndex, highlightedNet, onSelectNet }: NetPanelProps) {
  const rows = rankedNets(board, netIndex);

  return (
    <div className="net-panel">
      <h3>Nets ({rows.length})</h3>
      <p className="hint">Click a net, or click any pad/track/via on the board.</p>
      <ul className="net-list">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              className={`net-item ${highlightedNet === row.id ? "active" : ""}`}
              onClick={() => onSelectNet(highlightedNet === row.id ? undefined : row.id)}
            >
              <span className="net-name">{row.name}</span>
              <span className="net-count">{row.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
