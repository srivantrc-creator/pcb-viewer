import { readFileSync } from "node:fs";
import { parseKicadPcb } from "../src/lib/kicadParser";
import { buildNetIndex, rankedNets } from "../src/lib/netUtils";

const src = readFileSync(new URL("../public/sample-board.kicad_pcb", import.meta.url), "utf-8");
const board = parseKicadPcb(src);

console.log("layers:", board.layers.length);
console.log("nets:", board.nets.size);
console.log("footprints:", board.footprints.length, board.footprints.map((f) => f.reference));
console.log("items:", board.items.length);
console.log("outline segments:", board.outline.segments.length);
console.log("bounds:", board.bounds);

const idx = buildNetIndex(board);
console.log("nets with copper items:");
for (const row of rankedNets(board, idx)) {
  console.log(`  ${row.name}: ${row.count} items`);
}

const totalPads = board.footprints.reduce((sum, f) => sum + f.pads.length, 0);
console.log("total pads:", totalPads);

if (board.footprints.length !== 9) throw new Error("expected 9 footprints");
if (board.outline.segments.length < 4) throw new Error("expected board outline segments");
if (idx.size === 0) throw new Error("expected at least one net with copper items");
console.log("OK: sample board parses cleanly.");
