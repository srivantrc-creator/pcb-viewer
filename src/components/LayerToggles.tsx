import { LAYER_STYLES } from "../lib/layerStyle";

interface LayerTogglesProps {
  visibleLayers: Set<string>;
  onToggle: (layer: string) => void;
  presentLayers: Set<string>;
}

export default function LayerToggles({ visibleLayers, onToggle, presentLayers }: LayerTogglesProps) {
  return (
    <div className="layer-toggles">
      <h3>Layers</h3>
      {LAYER_STYLES.filter((l) => presentLayers.has(l.id)).map((layer) => (
        <label key={layer.id} className="layer-row">
          <input
            type="checkbox"
            checked={visibleLayers.has(layer.id)}
            onChange={() => onToggle(layer.id)}
          />
          <span className="swatch" style={{ background: layer.color }} />
          <span className="layer-label">{layer.label}</span>
        </label>
      ))}
    </div>
  );
}
