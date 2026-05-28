function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function nearestNode(layout, point, maxDistance) {
  let best = null;
  let bestD = maxDistance;

  for (const [nodeId, p] of layout.positions.entries()) {
    const d = dist(point, p);
    if (d <= bestD) {
      bestD = d;
      best = { nodeId, point: p, distance: d };
    }
  }

  return best;
}

function distanceToSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;

  const abLen2 = abx * abx + aby * aby;
  if (abLen2 <= 1e-12) return dist(point, a);

  let t = (apx * abx + apy * aby) / abLen2;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: a.x + t * abx, y: a.y + t * aby };
  return dist(point, proj);
}

export function nearestComponent(layout, point, maxDistance) {
  let best = null;
  let bestD = maxDistance;

  for (const entry of layout.components) {
    const d = distanceToSegment(point, entry.p1, entry.p2);
    if (d <= bestD) {
      bestD = d;
      best = { component: entry.component, distance: d };
    }
  }

  return best;
}

