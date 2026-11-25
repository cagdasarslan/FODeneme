import * as THREE from 'three';

// Prosedürel at + binici için ortak geometri / malzeme önbelleği.
// Her şey modül seviyesinde bir kez üretilir; bileşenler yalnızca paylaşır
// (asla dispose edilmez). Low-poly + flatShading görünüm.

const _geo = new Map();
function cached(key, make) {
  let g = _geo.get(key);
  if (!g) { g = make(); _geo.set(key, g); }
  return g;
}

export const BOX = new THREE.BoxGeometry(1, 1, 1);
export const BALL = new THREE.SphereGeometry(0.5, 8, 6);          // çap 1
export const HALF_BALL = new THREE.SphereGeometry(0.5, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
export const cyl  = (rt, rb, h, s = 6) => cached(`c${rt}|${rb}|${h}|${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
export const cone = (r, h, s = 6) => cached(`k${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
export const capsule = (r, l, s = 8) => cached(`p${r}|${l}|${s}`, () => new THREE.CapsuleGeometry(r, l, 2, s));

const _mat = new Map();
// opts: r=roughness, m=metalness, e=emissive color, ei=emissive intensity, own=önbelleğe alma anahtarı eki
export function mat(color, o = {}) {
  const key = `${color}|${o.r ?? 0.85}|${o.m ?? 0}|${o.e ?? ''}|${o.ei ?? 0}|${o.own ?? ''}`;
  let m = _mat.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, flatShading: true,
      roughness: o.r ?? 0.85, metalness: o.m ?? 0,
      emissive: o.e ?? '#000000', emissiveIntensity: o.ei ?? 0,
    });
    _mat.set(key, m);
  }
  return m;
}

// Tek parça mesh kısayolu (gölge atar)
export function P({ g = BOX, m, p, s, r, shadow = true }) {
  return <mesh geometry={g} material={m} position={p} scale={s} rotation={r} castShadow={shadow} />;
}

export const darken = (hex, f) => '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();
export const luminance = (hex) => { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };
