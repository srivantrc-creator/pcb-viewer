# Chalem Circuit Lab

An interactive toolkit for linear circuit analysis — the kind of tool
you'd actually use to check homework, not just something to put on a
resume. Covers everything from basic resistive DC circuits through AC
phasor analysis, first-order transients, diodes, and MOSFETs.

## What's in it

- **Circuit Builder** — enter a netlist (elements between labeled nodes,
  node 0 = ground), and it solves for every node voltage and element
  current/power using Modified Nodal Analysis. The schematic redraws
  itself as a textbook-style orthogonal diagram — resistor zigzags,
  source circles, an IEEE ground symbol, and labeled current-reference
  arrows — for any netlist you build, not just a fixed example. The same
  solver runs in DC mode and AC/phasor mode (R/L/C as complex impedances
  at a chosen frequency) — DC is just AC at ω = 0.
  - **Thevenin/Norton tab**: pick two "port" nodes, get V_th, R_th/Z_th, and I_N.
  - **Superposition tab**: see each independent source's individual
    contribution to a node voltage, with the others zeroed.
- **First-Order Calculator** — RC/RL step response: time constant, the
  general solution equation, and a plotted response curve.
- **Magnetics Calculator** — coupling coefficient k, ideal transformer
  turns ratio, and reflected impedance.
- **Diode Calculator** — solves the standard series
  source+resistor+diode circuit with the constant-voltage-drop model,
  showing the assume-ON-then-check worked steps.
- **MOSFET Calculator** — bias-point region check (cutoff/triode/
  saturation), g_m and r_o, and common-source amplifier gain.

## Why not one generic circuit simulator for everything?

Diodes and MOSFETs are nonlinear, so "just solve it" isn't really a thing
the way it is for a linear resistor network — those sections are built
around specific hand-analysis methods (constant-voltage-drop, square-law
region checks) instead of pretending to be SPICE.

## Running locally

```bash
npm install
npm run dev
```

## Verifying the solver

The Modified Nodal Analysis engine has a standalone numeric test suite
(voltage/current dividers, Thevenin equivalents, superposition, and an AC
RC divider checked against hand-calculated impedance values):

```bash
npx tsx scripts/verify-circuit.ts
```

## Deploying to Vercel

Standard Vite + React + TypeScript app — Vercel auto-detects everything.
Push to GitHub, import the repo at vercel.com/new, deploy:

```bash
npm install -g vercel
vercel --prod
```
