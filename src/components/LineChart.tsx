interface LineChartProps {
  data: { t: number; x: number }[];
  xLabel: string;
  yLabel: string;
  width?: number;
  height?: number;
}

export default function LineChart({ data, xLabel, yLabel, width = 560, height = 260 }: LineChartProps) {
  if (data.length === 0) return null;
  const pad = { left: 54, right: 16, top: 16, bottom: 34 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const xs = data.map((d) => d.t);
  const ys = data.map((d) => d.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMinRaw = Math.min(...ys, 0);
  const yMaxRaw = Math.max(...ys, 0);
  const yPadding = (yMaxRaw - yMinRaw) * 0.1 || 1;
  const yMin = yMinRaw - yPadding;
  const yMax = yMaxRaw + yPadding;

  const sx = (t: number) => pad.left + ((t - xMin) / (xMax - xMin || 1)) * innerW;
  const sy = (x: number) => pad.top + innerH - ((x - yMin) / (yMax - yMin || 1)) * innerH;

  const path = data.map((d, i) => `${i === 0 ? "M" : "L"} ${sx(d.t).toFixed(2)} ${sy(d.x).toFixed(2)}`).join(" ");
  const zeroY = sy(0);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="line-chart">
      <rect width={width} height={height} fill="#0b0f17" />
      {/* Axes */}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + innerH} stroke="#3a4356" />
      <line x1={pad.left} y1={pad.top + innerH} x2={pad.left + innerW} y2={pad.top + innerH} stroke="#3a4356" />
      {yMin < 0 && yMax > 0 && (
        <line x1={pad.left} y1={zeroY} x2={pad.left + innerW} y2={zeroY} stroke="#26314a" strokeDasharray="4 4" />
      )}
      <path d={path} fill="none" stroke="#e8734a" strokeWidth={2} />
      <text x={pad.left + innerW / 2} y={height - 6} textAnchor="middle" fontSize={11} fill="#8a95a8">
        {xLabel}
      </text>
      <text x={14} y={pad.top + innerH / 2} textAnchor="middle" fontSize={11} fill="#8a95a8" transform={`rotate(-90 14 ${pad.top + innerH / 2})`}>
        {yLabel}
      </text>
      <text x={pad.left} y={pad.top + innerH + 16} fontSize={10} fill="#5b7a99">
        0
      </text>
      <text x={pad.left + innerW} y={pad.top + innerH + 16} fontSize={10} fill="#5b7a99" textAnchor="end">
        {xMax.toPrecision(3)}
      </text>
      <text x={pad.left - 6} y={pad.top + 8} fontSize={10} fill="#5b7a99" textAnchor="end">
        {yMax.toPrecision(3)}
      </text>
      <text x={pad.left - 6} y={pad.top + innerH} fontSize={10} fill="#5b7a99" textAnchor="end">
        {yMin.toPrecision(3)}
      </text>
    </svg>
  );
}
