import type { PcbBoard, BoardItem } from "./types";

/** Build a net id -> items index once per board, so click-to-highlight is O(1). */
export function buildNetIndex(board: PcbBoard): Map<number, BoardItem[]> {
  const index = new Map<number, BoardItem[]>();
  for (const item of board.items) {
    if (item.netId === undefined) continue;
    const list = index.get(item.netId);
    if (list) list.push(item);
    else index.set(item.netId, [item]);
  }
  return index;
}

export function netLabel(board: PcbBoard, netId: number | undefined): string {
  if (netId === undefined) return "(no net)";
  const net = board.nets.get(netId);
  if (!net || !net.name) return `Net ${netId}`;
  return net.name;
}

/** Nets sorted by how many copper items they touch, most-connected first. */
export function rankedNets(
  board: PcbBoard,
  netIndex: Map<number, BoardItem[]>
): { id: number; name: string; count: number }[] {
  const rows: { id: number; name: string; count: number }[] = [];
  for (const [id, items] of netIndex) {
    rows.push({ id, name: netLabel(board, id), count: items.length });
  }
  rows.sort((a, b) => b.count - a.count);
  return rows;
}
