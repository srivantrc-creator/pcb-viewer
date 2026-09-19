import { SYLLABUS, type ToolKey } from "../lib/syllabus";

interface CourseMapProps {
  onNavigate: (tool: ToolKey) => void;
}

export default function CourseMap({ onNavigate }: CourseMapProps) {
  return (
    <div className="calc-page">
      <h2>What to use, week by week</h2>
      <p className="calc-intro">
        Built around a standard intro linear-circuits syllabus (sources & resistors through MOSFET
        amplifiers). Find your week below and jump straight to the matching tool.
      </p>
      <table className="syllabus-table">
        <thead>
          <tr>
            <th>Week</th>
            <th>Topics</th>
            <th>Tool</th>
          </tr>
        </thead>
        <tbody>
          {SYLLABUS.map((row) => (
            <tr key={row.weeks}>
              <td className="week-cell">{row.weeks}</td>
              <td>{row.topics}</td>
              <td>
                {row.tool ? (
                  <button className="tool-link" onClick={() => onNavigate(row.tool!)}>
                    {row.toolNote}
                  </button>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint" style={{ marginTop: 18 }}>
        The Circuit Builder covers weeks 1-10 with one solver (nodal/mesh analysis, Thevenin/Norton,
        superposition, and AC phasor analysis are all the same underlying math — DC is just AC at
        ω = 0). Diode and MOSFET circuits are nonlinear, so those sections are calculators built
        around the specific hand-analysis methods your course teaches (constant-voltage-drop model,
        square-law region checks) rather than a generic solver.
      </p>
    </div>
  );
}
