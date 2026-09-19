// Simple auto-layout for the schematic view: place ground at the bottom,
// and every other node evenly around a circle above it. Not a real
// schematic router, but enough to see the topology and read values.

export interface NodePos {
  x: number;
  y: number;
}

export function layoutNodes(nodes: number[], width = 640, height = 420): Map<number, NodePos> {
  const positions = new Map<number, NodePos>();
  const cx = width / 2;
  const cy = height / 2 - 10;
  const radius = Math.min(width, height) / 2 - 70;

  const others = nodes.filter((n) => n !== 0).sort((a, b) => a - b);
  const hasGround = nodes.includes(0);

  if (hasGround) {
    positions.set(0, { x: cx, y: cy + radius });
  }

  const count = others.length;
  if (count === 0) return positions;

  // Spread the remaining nodes across the top arc (avoiding the ground spot).
  const startAngle = hasGround ? -Math.PI * 0.92 : -Math.PI / 2;
  const endAngle = hasGround ? -Math.PI * 0.08 : (3 * Math.PI) / 2 - Math.PI / 2;
  const span = hasGround ? endAngle - startAngle : 2 * Math.PI;

  others.forEach((n, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angle = hasGround ? startAngle + t * span : -Math.PI / 2 + t * span;
    positions.set(n, {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  });

  return positions;
}
