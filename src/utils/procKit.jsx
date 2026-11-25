import * as THREE from 'three';
import { IS_MOBILE } from '@/utils/device';
import { useMemo as _useMemo, useEffect as _useEffect, useRef as _useRef } from 'react';
import { useFrame as _useFrame } from '@react-three/fiber';

// Kodla üretilen dekor için ortak parçalar. GLB modeller yerine birkaç temel
// gövde (kutu, silindir, koni, kaya) paylaşılan geometri/malzemeyle kullanılır;
// her öğe onlarca üçgen. Tabanlar y=0'dadır, çağıran ölçekler.
export const G = {
  box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0),
  cyl12: new THREE.CylinderGeometry(1, 1, 1, 12).translate(0, 0.5, 0),
  cone8: new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0),
  dome: new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
  rock: new THREE.DodecahedronGeometry(1, 0),
  plane: new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0),
  // Ek gövdeler (eklemeli; yukarıdakiler değişmedi)
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0),
  cone4: new THREE.ConeGeometry(0.7071, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), // 1×1 tabanlı piramit
  cone6: new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0),
  blob: new THREE.IcosahedronGeometry(1, 0),            // merkezli yaprak/çalı kümesi
  ball: new THREE.SphereGeometry(1, 8, 6),              // merkezli küre
  prism: makePrism(),                                   // üçgen çatı: x -0.5..0.5, y 0..1, z -0.5..0.5
  wheel: new THREE.CylinderGeometry(1, 1, 1, 10).rotateZ(Math.PI / 2), // x eksenli, merkezli
  quad: new THREE.PlaneGeometry(1, 1),                  // merkezli, +z'ye bakan tek yüz (pencere/ışık bandı)
  halfCylZ: new THREE.CylinderGeometry(1, 1, 1, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), // z eksenli yarım silindir (tonoz), taban y=0
};

function makePrism() {
  const g = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.99) pos.setX(i, 0);
  g.computeVertexNormals();
  return g;
}

// Satranç/desen dokusu (bayrak, afiş vb.)
export function makeCheckerTex(n = 4, a = '#111111', b = '#f4f4f4') {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const s = 64 / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    g.fillStyle = (x + y) % 2 ? a : b;
    g.fillRect(x * s, y * s, s, s);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function makeMats(colors) {
  const out = {};
  for (const [k, v] of Object.entries(colors)) {
    out[k] = typeof v === 'string'
      ? new THREE.MeshStandardMaterial({ color: v, roughness: 0.85, flatShading: true })
      : new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true, ...v });
  }
  return out;
}

const SHADOW = !IS_MOBILE;
export function makeP(MAT) {
  return function P({ g, m, p, s, r }) {
    return <mesh geometry={G[g]} material={MAT[m]} position={p} scale={s} rotation={r}
      castShadow={SHADOW} receiveShadow={SHADOW} />;
  };
}

// ── Toplu (batched) dekor ────────────────────────────────────────────────────
// Bir segmentteki yüzlerce statik parçayı TEK geometride birleştirir (köşe
// rengiyle); çizim çağrısı parça sayısından bağımsız olur. Üç kova: lit
// (ışıklı), glow (ışıksız parlak: pencere/lamba), blink (yanıp sönen, ortak
// malzemenin rengi bir yerde canlandırılır).

const _arrCache = new Map();
function geoArrays(geo) {
  let a = _arrCache.get(geo);
  if (!a) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    a = { pos: g.attributes.position.array, nrm: g.attributes.normal.array };
    _arrCache.set(geo, a);
  }
  return a;
}

export const BATCH_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
export const GLOW_MAT = new THREE.MeshBasicMaterial({ vertexColors: true });
export const BLINK_MAT = new THREE.MeshBasicMaterial({ vertexColors: true });
const _BUCKETS = ['lit', 'glow', 'blink'];

export function makeBatch() {
  const parts = { lit: [], glow: [], blink: [] };
  const stack = [new THREE.Matrix4()];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(),
    _v = new THREE.Vector3(), _s = new THREE.Vector3();
  const compose = (p, r, s) => {
    _v.set(p?.[0] || 0, p?.[1] || 0, p?.[2] || 0);
    if (typeof r === 'number') _e.set(0, r, 0); else _e.set(r?.[0] || 0, r?.[1] || 0, r?.[2] || 0);
    _q.setFromEuler(_e);
    if (s == null) _s.set(1, 1, 1); else if (typeof s === 'number') _s.set(s, s, s); else _s.set(s[0], s[1], s[2]);
    return _m.compose(_v, _q, _s);
  };
  const b = {
    tris: 0,
    push(p, r, s) { stack.push(stack[stack.length - 1].clone().multiply(compose(p, r, s))); return b; },
    pop() { if (stack.length > 1) stack.pop(); return b; },
    // g: G anahtarı veya geometri; c: renk (hex/Color); bucket: 'lit'|'glow'|'blink'
    add(g, c, p, s, r, bucket = 'lit') {
      const geo = typeof g === 'string' ? G[g] : g;
      const mat = stack[stack.length - 1].clone().multiply(compose(p, r, s));
      parts[bucket].push({ geo, mat, col: c instanceof THREE.Color ? c : new THREE.Color(c) });
      b.tris += geoArrays(geo).pos.length / 9;
      return b;
    },
    build() {
      const out = {};
      const _n = new THREE.Matrix3(), _p = new THREE.Vector3();
      for (const k of _BUCKETS) {
        const list = parts[k];
        if (!list.length) { out[k] = null; continue; }
        let n = 0;
        for (const it of list) n += geoArrays(it.geo).pos.length;
        const pos = new Float32Array(n), nrm = new Float32Array(n), col = new Float32Array(n);
        let o = 0;
        for (const it of list) {
          const a = geoArrays(it.geo);
          _n.getNormalMatrix(it.mat);
          for (let i = 0; i < a.pos.length; i += 3) {
            _p.set(a.pos[i], a.pos[i + 1], a.pos[i + 2]).applyMatrix4(it.mat);
            pos[o] = _p.x; pos[o + 1] = _p.y; pos[o + 2] = _p.z;
            _p.set(a.nrm[i], a.nrm[i + 1], a.nrm[i + 2]).applyMatrix3(_n).normalize();
            nrm[o] = _p.x; nrm[o + 1] = _p.y; nrm[o + 2] = _p.z;
            col[o] = it.col.r; col[o + 1] = it.col.g; col[o + 2] = it.col.b;
            o += 3;
          }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.computeBoundingSphere();
        out[k] = geo;
      }
      return out;
    },
  };
  return b;
}

// Tek bir köşe-renkli geometri (ör. InstancedMesh gövdesi) üretir
export function bakeGeo(fn) {
  const b = makeBatch();
  fn(b);
  return b.build().lit;
}

// build(b) ile doldurulan statik toplu dekor; deps değişince yeniden kurulur
// (ya da hazır `geos` = makeBatch().build() çıktısı verilebilir)
const _wp = new THREE.Vector3();
const SHADOW_NEAR_BACK = 110, SHADOW_NEAR_FRONT = 130;
export function Baked({ build, geos: given, deps = [], shadow = false, lod = 0 }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geos = _useMemo(() => { if (given) return given; const b = makeBatch(); build(b); return b.build(); }, [given, ...deps]);
  _useEffect(() => () => { for (const k of _BUCKETS) geos[k]?.dispose(); }, [geos]);
  const sh = shadow && SHADOW;
  const litRef = _useRef();
  // Gölgeyi yalnız kameraya yakın segmentler düşürür (uzaktakiler gölge
  // haritasında zaten görünmez; gölge geçişindeki üçgen yükü yarıya iner)
  // lod>0: segment kameradan bu kadar uzaktayken (sisin içinde) hiç çizilmez
  const grpRef = _useRef();
  _useFrame(() => {
    const g = grpRef.current; if (!g || (!sh && !lod)) return;
    g.getWorldPosition(_wp);
    const any = geos.lit || geos.glow || geos.blink;
    const cz = _wp.z + (any ? any.boundingSphere.center.z : 0);
    if (lod) g.visible = cz > -lod;
    if (sh && litRef.current) litRef.current.castShadow = cz > -SHADOW_NEAR_BACK && cz < SHADOW_NEAR_FRONT;
  });
  return (<group ref={grpRef}>
    {geos.lit && <mesh ref={litRef} geometry={geos.lit} material={BATCH_MAT} castShadow={sh} receiveShadow={SHADOW} />}
    {geos.glow && <mesh geometry={geos.glow} material={GLOW_MAT} />}
    {geos.blink && <mesh geometry={geos.blink} material={BLINK_MAT} />}
  </group>);
}

// Ortak yanıp sönme: haritanın ana bileşeninde bir kez çağrılır
export function useBlink(speed = 2.2) {
  _useFrame(({ clock }) => {
    const v = Math.sin(clock.elapsedTime * speed * Math.PI) > 0.2 ? 1 : 0.12;
    BLINK_MAT.color.setScalar(v);
  });
}

// Hareketli tekrarlanan öğeler: tek InstancedMesh + tek useFrame.
// init(i, o) başlangıç dönüşümü (o: Object3D, o.userData serbest); update(i, t, o, dt)
// her karede yalnız dönüşüm günceller. margin: sınır küresine eklenecek pay.
// colors: örnek başına renk (köşe rengiyle çarpılır); lod>0: o mesafeden uzakta gizle/güncelleme yok
export function Anim({ geo, mat = BATCH_MAT, count, init, update, margin = 4, shadow = false, colors, lod = 0 }) {
  const ref = _useRef();
  const objs = _useMemo(() => Array.from({ length: count }, () => new THREE.Object3D()), [count]);
  _useEffect(() => {
    const m = ref.current; if (!m) return;
    objs.forEach((o, i) => { init(i, o); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.instanceMatrix.needsUpdate = true;
    if (colors) { colors.forEach((c, i) => m.setColorAt(i, c)); if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    m.computeBoundingSphere();
    if (m.boundingSphere) m.boundingSphere.radius += margin;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objs]);
  _useFrame(({ clock }, dt) => {
    const m = ref.current; if (!m) return;
    if (lod && m.boundingSphere) {
      m.getWorldPosition(_wp);
      m.visible = _wp.z + m.boundingSphere.center.z > -lod;
    }
    if (!update || !m.visible) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) { const o = objs[i]; update(i, t, o, dt); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, count]} castShadow={shadow && SHADOW} receiveShadow={false} />;
}

// Tohumlu sözde-rastgele üreteç (deterministik yerleşim için)
export function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Ufuk silüeti: sisten etkilenmeyen, gökyüzüne yakın tonda uzak dağ/tepe halkası
// (statik; kamera uzak düzlemi ~500 olduğundan 380-470 m arası yerleştirilir).
export function HorizonRing({ colors, seed = 1, count = 22, minR = 400, maxR = 470, hMin = 25, hMax = 70, wMin = 40, wMax = 90, kind = 'cone6', arc = [-Math.PI * 0.95, -Math.PI * 0.05] }) {
  const geos = _useMemo(() => {
    const rng = mulberry(seed), b = makeBatch();
    for (let i = 0; i < count; i++) {
      const a = arc[0] + (arc[1] - arc[0]) * (i + rng() * 0.8) / count;
      const r = minR + rng() * (maxR - minR);
      const w = wMin + rng() * (wMax - wMin), h = hMin + rng() * (hMax - hMin);
      b.add(kind, colors[i % colors.length], [Math.cos(a) * r, -2, Math.sin(a) * r], [w, h, w * 0.7], [0, rng() * 3, 0]);
    }
    return b.build();
  }, [seed]);
  const mat = _useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), []);
  _useEffect(() => () => { geos.lit?.dispose(); mat.dispose(); }, [geos, mat]);
  return <mesh geometry={geos.lit} material={mat} />;
}
