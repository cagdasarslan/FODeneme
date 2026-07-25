// Paylaşılan obstacle konum kaydı — ObstacleSpawner yazar, Horse okur.
// Module-level mutable map: id → {x, z, active, TypeFn}
const registry = new Map();

export const obstacleRegistry = registry;

export function upsertObstacle(id, x, z, TypeFn) {
  const entry = registry.get(id);
  if (entry) { entry.x = x; entry.z = z; if (TypeFn) entry.TypeFn = TypeFn; }
  else registry.set(id, { x, z, active: true, TypeFn });
}

export function setObstacleActive(id, active) {
  const entry = registry.get(id);
  if (entry) entry.active = active;
}

export function clearRegistry() {
  registry.clear();
}
