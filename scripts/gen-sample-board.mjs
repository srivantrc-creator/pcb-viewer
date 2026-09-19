// Generates a small but realistic two-layer "IoT sensor node" board as a
// valid .kicad_pcb file, so the viewer has a meaningful demo dataset without
// needing a real KiCad install in this environment. Run with:
//   node scripts/gen-sample-board.mjs
import { writeFileSync } from "node:fs";

const NETS = {
  GND: 1,
  VCC: 2,
  VIN: 3,
  SDA: 4,
  SCL: 5,
  RST: 6,
  LED_CTRL: 7,
  LED_A: 8,
};

const netEntries = [[0, ""], ...Object.entries(NETS).map(([name, id]) => [id, name])];

let out = [];
const push = (s) => out.push(s);

push(`(kicad_pcb (version 20221018) (generator "pcb-viewer-sample-gen")`);
push(`  (general (thickness 1.6))`);
push(`  (paper "A4")`);
push(`  (layers`);
push(`    (0 "F.Cu" signal)`);
push(`    (31 "B.Cu" signal)`);
push(`    (32 "B.Adhes" user)`);
push(`    (33 "F.Adhes" user)`);
push(`    (34 "B.Paste" user)`);
push(`    (35 "F.Paste" user)`);
push(`    (36 "B.SilkS" user)`);
push(`    (37 "F.SilkS" user)`);
push(`    (38 "B.Mask" user)`);
push(`    (39 "F.Mask" user)`);
push(`    (44 "Edge.Cuts" user)`);
push(`  )`);

for (const [id, name] of netEntries) {
  push(`  (net ${id} "${name}")`);
}

// ---- Board outline: 60mm x 42mm rectangle ----
const BOARD_W = 60;
const BOARD_H = 42;
function edge(x1, y1, x2, y2) {
  push(
    `  (gr_line (start ${x1} ${y1}) (end ${x2} ${y2}) (layer "Edge.Cuts") (width 0.15))`
  );
}
edge(0, 0, BOARD_W, 0);
edge(BOARD_W, 0, BOARD_W, BOARD_H);
edge(BOARD_W, BOARD_H, 0, BOARD_H);
edge(0, BOARD_H, 0, 0);

// Mounting holes near corners (non-plated, just graphics + a via-like pad look)
const mountingHoles = [
  [4, 4],
  [BOARD_W - 4, 4],
  [4, BOARD_H - 4],
  [BOARD_W - 4, BOARD_H - 4],
];
for (const [x, y] of mountingHoles) {
  push(`  (gr_circle (center ${x} ${y}) (end ${x + 1.5} ${y}) (layer "Edge.Cuts") (width 0.1))`);
}

// Title text (silkscreen)
push(
  `  (gr_text "SENSOR-NODE-01  REV A" (at ${BOARD_W / 2} ${BOARD_H - 2}) (layer "F.SilkS") (effects (font (size 1.2 1.2) (thickness 0.15))))`
);

let fpCount = 0;

function footprintHeader(lib, ref, value, x, y, rot, layer) {
  fpCount++;
  push(`  (footprint "${lib}" (layer "${layer}") (at ${x} ${y}${rot ? " " + rot : ""})`);
  push(`    (fp_text reference "${ref}" (at 0 -2) (layer "F.SilkS") (effects (font (size 0.8 0.8) (thickness 0.12))))`);
  push(`    (fp_text value "${value}" (at 0 2) (layer "F.Fab") (effects (font (size 0.8 0.8) (thickness 0.12))))`);
}

function smdPad(num, dx, dy, w, h, layer, netId, netName, shape = "roundrect") {
  const netClause = netId !== undefined ? ` (net ${netId} "${netName}")` : "";
  push(
    `    (pad "${num}" smd ${shape} (at ${dx} ${dy}) (size ${w} ${h}) (layers "${layer}" "${layer.replace(
      "Cu",
      "Paste"
    )}" "${layer.replace("Cu", "Mask")}")${netClause}${
      shape === "roundrect" ? " (roundrect_rratio 0.25)" : ""
    })`
  );
}

function thruPad(num, dx, dy, dia, drill, netId, netName) {
  const netClause = netId !== undefined ? ` (net ${netId} "${netName}")` : "";
  push(
    `    (pad "${num}" thru_hole circle (at ${dx} ${dy}) (size ${dia} ${dia}) (drill ${drill}) (layers "*.Cu" "*.Mask")${netClause})`
  );
}

function endFootprint() {
  push(`  )`);
}

// ---- U1: 8-pin dual-row IC (MCU) at (34, 18) ----
{
  const x = 34,
    y = 16;
  footprintHeader("Package_SO:SOIC-8_3.9x4.9mm_P1.27mm", "U1", "ATtiny-Sensor-MCU", x, y, 0, "F.Cu");
  const pinNets = [
    [1, NETS.GND, "GND"],
    [2, NETS.SDA, "SDA"],
    [3, NETS.SCL, "SCL"],
    [4, NETS.RST, "RST"],
    [5, NETS.LED_CTRL, "LED_CTRL"],
    [6, undefined, ""],
    [7, undefined, ""],
    [8, NETS.VCC, "VCC"],
  ];
  // left column pins 1-4 top-to-bottom, right column pins 8-5 top-to-bottom
  const pitch = 1.27;
  const leftX = -2.5;
  const rightX = 2.5;
  const startY = -1.5 * pitch;
  for (let i = 0; i < 4; i++) {
    const [num, net, name] = pinNets[i];
    smdPad(num, leftX, startY + i * pitch, 1.55, 0.6, "F.Cu", net, name, "rect");
  }
  for (let i = 0; i < 4; i++) {
    const [num, net, name] = pinNets[7 - i];
    smdPad(num, rightX, startY + i * pitch, 1.55, 0.6, "F.Cu", net, name, "rect");
  }
  endFootprint();
}
const U1 = { x: 34, y: 16 };

// ---- U2: SOT-23 regulator at (10, 10) ----
{
  const x = 12,
    y = 10;
  footprintHeader("Package_TO_SOT_SMD:SOT-23", "U2", "AP2112K-3.3", x, y, 0, "F.Cu");
  smdPad(1, -0.95, 1.0, 0.9, 1.0, "F.Cu", NETS.GND, "GND");
  smdPad(2, 0.95, 1.0, 0.9, 1.0, "F.Cu", NETS.VCC, "VCC");
  smdPad(3, 0, -1.0, 0.9, 1.0, "F.Cu", NETS.VIN, "VIN");
  endFootprint();
}
const U2 = { x: 12, y: 10 };

// ---- J1: 2-pin power connector at (4, 21) ----
{
  const x = 5,
    y = 21;
  footprintHeader("Connector_JST:JST_PH_S2B-PH-K_1x02_P2.00mm_Vertical", "J1", "PWR_IN", x, y, 90, "F.Cu");
  thruPad(1, 0, -1.0, 1.7, 1.0, NETS.VIN, "VIN");
  thruPad(2, 0, 1.0, 1.7, 1.0, NETS.GND, "GND");
  endFootprint();
}
const J1 = { x: 5, y: 21 };

// ---- C1: input decoupling cap near regulator, 0603 ----
{
  const x = 8,
    y = 15;
  footprintHeader("Capacitor_SMD:C_0603_1608Metric", "C1", "1uF", x, y, 90, "F.Cu");
  smdPad(1, -0.8, 0, 0.9, 0.95, "F.Cu", NETS.VIN, "VIN");
  smdPad(2, 0.8, 0, 0.9, 0.95, "F.Cu", NETS.GND, "GND");
  endFootprint();
}
const C1 = { x: 8, y: 15 };

// ---- C2: output decoupling cap near regulator, 0603 ----
{
  const x = 17,
    y = 15;
  footprintHeader("Capacitor_SMD:C_0603_1608Metric", "C2", "1uF", x, y, 90, "F.Cu");
  smdPad(1, -0.8, 0, 0.9, 0.95, "F.Cu", NETS.VCC, "VCC");
  smdPad(2, 0.8, 0, 0.9, 0.95, "F.Cu", NETS.GND, "GND");
  endFootprint();
}
const C2 = { x: 17, y: 15 };

// ---- R1: I2C pull-up on SDA, 0603 ----
{
  const x = 24,
    y = 8;
  footprintHeader("Resistor_SMD:R_0603_1608Metric", "R1", "4.7k", x, y, 0, "F.Cu");
  smdPad(1, -0.8, 0, 0.9, 0.95, "F.Cu", NETS.VCC, "VCC");
  smdPad(2, 0.8, 0, 0.9, 0.95, "F.Cu", NETS.SDA, "SDA");
  endFootprint();
}
const R1 = { x: 24, y: 8 };

// ---- R3: I2C pull-up on SCL, 0603 ----
{
  const x = 28,
    y = 8;
  footprintHeader("Resistor_SMD:R_0603_1608Metric", "R3", "4.7k", x, y, 0, "F.Cu");
  smdPad(1, -0.8, 0, 0.9, 0.95, "F.Cu", NETS.VCC, "VCC");
  smdPad(2, 0.8, 0, 0.9, 0.95, "F.Cu", NETS.SCL, "SCL");
  endFootprint();
}
const R3 = { x: 28, y: 8 };

// ---- R2: LED series resistor, 0603 ----
{
  const x = 46,
    y = 30;
  footprintHeader("Resistor_SMD:R_0603_1608Metric", "R2", "330", x, y, 0, "F.Cu");
  smdPad(1, -0.8, 0, 0.9, 0.95, "F.Cu", NETS.LED_CTRL, "LED_CTRL");
  smdPad(2, 0.8, 0, 0.9, 0.95, "F.Cu", NETS.LED_A, "LED_A");
  endFootprint();
}
const R2 = { x: 46, y: 30 };

// ---- LED1: status LED, 0603 ----
{
  const x = 52,
    y = 30;
  footprintHeader("LED_SMD:LED_0603_1608Metric", "LED1", "Green", x, y, 0, "F.Cu");
  smdPad(1, -0.8, 0, 0.9, 0.95, "F.Cu", NETS.LED_A, "LED_A");
  smdPad(2, 0.8, 0, 0.9, 0.95, "F.Cu", NETS.GND, "GND");
  endFootprint();
}
const LED1 = { x: 52, y: 30 };

// ---- Routing: tracks + a couple of vias to B.Cu for GND stitching ----
function track(x1, y1, x2, y2, net, name, layer = "F.Cu", width = 0.25) {
  push(
    `  (segment (start ${x1} ${y1}) (end ${x2} ${y2}) (width ${width}) (layer "${layer}") (net ${net}))`
  );
}
function via(x, y, net) {
  push(
    `  (via (at ${x} ${y}) (size 0.8) (drill 0.4) (layers "F.Cu" "B.Cu") (net ${net}))`
  );
}

// VIN: J1 -> C1 -> U2 pin3
track(J1.x, J1.y - 1.0, C1.x - 0.8, C1.y, NETS.VIN, "VIN");
track(C1.x - 0.8, C1.y, U2.x, U2.y - 1.0, NETS.VIN, "VIN");

// GND: J1 -> C1 -> U2 pin1, and GND runs to C2, U1 pin1, LED1
track(J1.x, J1.y + 1.0, C1.x + 0.8, C1.y, NETS.GND, "GND");
track(C1.x + 0.8, C1.y, U2.x - 0.95, U2.y + 1.0, NETS.GND, "GND");
track(U2.x - 0.95, U2.y + 1.0, C2.x + 0.8, C2.y, NETS.GND, "GND");
track(C2.x + 0.8, C2.y, U1.x - 2.5 - 0, U1.y - 1.5 * 1.27, NETS.GND, "GND");
track(52 - 0.8, 30, 52, 33, NETS.GND, "GND"); // LED1 pad2 stub
via(52, 33, NETS.GND);
track(52, 33, 40, 33, NETS.GND, "GND", "B.Cu");
track(40, 33, 34 - 2.5, 16 + 1.5 * 1.27, NETS.GND, "GND", "B.Cu");

// VCC: U2 pin2 -> C2 -> R1 -> R3 -> U1 pin8
track(U2.x + 0.95, U2.y + 1.0, C2.x - 0.8, C2.y, NETS.VCC, "VCC");
track(C2.x - 0.8, C2.y, R1.x - 0.8, R1.y, NETS.VCC, "VCC");
track(R1.x - 0.8, R1.y, R3.x - 0.8, R3.y, NETS.VCC, "VCC");
track(R3.x - 0.8, R3.y, U1.x + 2.5, U1.y - 1.5 * 1.27, NETS.VCC, "VCC");

// SDA: R1 -> U1 pin2 ; SCL: R3 -> U1 pin3
track(R1.x + 0.8, R1.y, U1.x - 2.5, U1.y - 0.5 * 1.27, NETS.SDA, "SDA");
track(R3.x + 0.8, R3.y, U1.x - 2.5, U1.y + 0.5 * 1.27, NETS.SCL, "SCL");

// LED_CTRL: U1 pin5 -> R2
track(U1.x + 2.5, U1.y + 0.5 * 1.27, R2.x - 0.8, R2.y, NETS.LED_CTRL, "LED_CTRL");
track(R2.x - 0.8, R2.y, 46, 30, NETS.LED_CTRL, "LED_CTRL");

// LED_A: R2 -> LED1
track(R2.x + 0.8, R2.y, LED1.x - 0.8, LED1.y, NETS.LED_A, "LED_A");

// A GND pour on B.Cu for realism (simple rectangle polygon zone)
push(`  (zone (net ${NETS.GND}) (net_name "GND") (layer "B.Cu") (hatch edge 0.5)`);
push(`    (polygon`);
push(`      (pts`);
push(`        (xy 2 2) (xy ${BOARD_W - 2} 2) (xy ${BOARD_W - 2} ${BOARD_H - 2}) (xy 2 ${BOARD_H - 2})`);
push(`      )`);
push(`    )`);
push(`  )`);

push(`)`);

const text = out.join("\n") + "\n";
writeFileSync(new URL("../public/sample-board.kicad_pcb", import.meta.url), text);
console.log(`Wrote sample-board.kicad_pcb with ${fpCount} footprints.`);
