# PCB Viewer

An interactive KiCad PCB layout viewer built for a resume/portfolio project.
Upload a `.kicad_pcb` file (or load the bundled sample board) and explore its
copper layers, silkscreen, footprints, and nets directly in the browser —
click any pad, track, or via to highlight its full net across every layer.

## What it demonstrates

- **A from-scratch S-expression parser** for KiCad's native PCB format
  (`src/lib/sexpr.ts`, `src/lib/kicadParser.ts`) — no third-party KiCad
  library, so it shows an understanding of the underlying data model (nets,
  footprints, pads, layers), not just a CAD tool's GUI.
- **Net-aware rendering**: every board item is indexed by net ID
  (`src/lib/netUtils.ts`), so clicking any copper feature highlights every
  other item on the same net across all layers in O(1).
- **A generated demo board** (`scripts/gen-sample-board.mjs`) — a small
  9-component IoT sensor node with a regulator, MCU, I2C pull-ups, and an
  LED driver stage, so the app has a realistic dataset to show off without
  needing KiCad installed.

## Running locally

```bash
npm install
npm run dev
```

Open the printed local URL. Click **Load sample board**, or **Upload
.kicad_pcb** to try your own KiCad export.

## Regenerating the sample board

```bash
node scripts/gen-sample-board.mjs
```

## Deploying to Vercel

This is a standard Vite + React + TypeScript app — Vercel auto-detects the
framework and build settings, so there's nothing to configure.

**Option A — from GitHub (recommended):**

1. Push this folder to a new GitHub repository.
2. Go to [vercel.com/new](https://vercel.com/new) and import that repo.
3. Leave the defaults (Framework Preset: Vite, Build Command: `npm run
   build`, Output Directory: `dist`) and click **Deploy**.
4. Vercel gives you a live `https://your-project.vercel.app` URL, and every
   push to `main` redeploys automatically.

**Option B — from the command line:**

```bash
npm install -g vercel   # one-time
cd pcb-viewer
vercel                  # first deploy, follow the prompts
vercel --prod           # promote to your production URL
```

## Known limitations (by design, for scope)

- Footprint courtyard/outline silkscreen graphics (`fp_line` inside a
  footprint) aren't rendered — only reference-designator text and pads.
  Board-level graphics (`gr_line`, `gr_circle`, board outline) render fully.
- Pad and footprint rotation follows a standard rotation-matrix convention;
  it's visually consistent but hasn't been cross-checked pixel-for-pixel
  against KiCad's own renderer for every rotation edge case.
- Zones are drawn from their declared outline polygon, not the
  copper-fill algorithm KiCad computes at plot time (no thermal reliefs,
  keepout carve-outs, etc.).
