export const carrotRegistry = new Map();
export function upsertCarrot(id, x, z, active) {
  carrotRegistry.set(id, { x, z, active });
}
export function setCarrotCollected(id) {
  const c = carrotRegistry.get(id);
  if (c) c.active = false;
}
