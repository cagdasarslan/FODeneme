import * as THREE from 'three';

export const CITY3_SCALE = 20;

// Outer circuit — clockwise oval around the inner city blocks (mavi çizgi).
const RAW_WAYPOINTS = [
  // === Kuzey düzlüğü ===
  [   1,  0.5,  -38],   //  1  kuzey orta
  [  50,  0.5,  -35],   //  2  kuzey-doğu
  // === Doğu köşesi ===
  [  78,  0.5,  -20],   //  3  doğu üst
  [  90,  0.5,    5],   //  4  doğu üst-orta
  [  93,  0.5,   35],   //  5  doğu orta
  [  82,  0.5,   62],   //  6  doğu alt
  // === Güney-doğu köşesi ===
  [  60,  0.5,   80],   //  7  güney-doğu
  [  15,  0.5,   88],   //  8  güney sağ
  // === Güney düzlüğü ===
  [ -20,  0.5,   88],   //  9  güney orta
  [ -50,  0.5,   83],   // 10  güney sol
  // === Güney-batı köşesi ===
  [ -75,  0.5,   70],   // 11  güney-batı
  [ -93,  0.5,   48],   // 12  batı alt
  // === Batı düzlüğü ===
  [ -97,  0.5,   20],   // 13  batı orta
  [ -93,  0.5,  -10],   // 14  batı üst
  // === Kuzey-batı köşesi ===
  [ -78,  0.5,  -30],   // 15  kuzey-batı
  [ -40,  0.5,  -40],   // 16  kuzey sol
  // CatmullRom kapalı döngü → 1'e döner
];

let _curve = null;
export function getCity3Curve() {
  if (_curve) return _curve;
  _curve = new THREE.CatmullRomCurve3(
    RAW_WAYPOINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    true,          // closed loop
    'catmullrom',
    0.5,
  );
  return _curve;
}

let _length = null;
export function getCity3Length() {
  if (_length !== null) return _length;
  _length = getCity3Curve().getLength();
  return _length;
}

const _pt  = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _up  = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3();

export function getCity3Frame(dist) {
  const L = getCity3Length();
  const t = ((dist % L) + L) % L / L;
  const curve = getCity3Curve();
  curve.getPointAt(t, _pt);
  curve.getTangentAt(t, _tan).normalize();
  _right.crossVectors(_tan, _up).normalize();
  return { point: _pt.clone(), tangent: _tan.clone(), right: _right.clone() };
}
