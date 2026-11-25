import * as THREE from 'three';

// Parke taşı / zemin karosu dokusu — bir kez kanvasa çizilir, yol düzlemine
// döşenir.
//
// Eskiden yol yüzeyi binlerce ayrı 3B kutudan (InstancedMesh) oluşuyordu:
// 6 yol parçası × ~2.100 taş × 12 üçgen ≈ 151.000 üçgen. Kamera yukarıdan
// baktığı için kutuların yan/alt yüzleri neredeyse hiç görünmüyordu ve taş
// yükseklik farkı birkaç santimdi. Aynı desen, palet ve tuğla düzeni dokuya
// çizilince yol parçası başına 2 üçgen kalıyor (Ortaçağ/Zindan'ın en ağır yükü).
//
// Kabartma hissi: her taşa üst-sol ışık, alt-sağ gölge ve rastgele ton farkı.

function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return `#${c.getHexString()}`;
}

/**
 * @param {object} o
 * @param {string[]} o.colors  taş renkleri (hex)
 * @param {string}   o.mortar  derz rengi
 * @param {number}   o.cells   dokudaki taş sütun/satır sayısı (desen bu aralıkla tekrarlar)
 * @param {number}   o.fill    taşın hücreyi doldurma oranı (0-1) — kalanı derz
 * @param {number}   o.jitter  taş konumu rastgeleliği (hücre oranı)
 * @param {number}   o.seed
 */
export function makeStoneTexture({ colors, mortar, cells = 16, fill = 0.9, jitter = 0.05, seed = 1 }) {
  const CELL = 64;
  const size = CELL * cells;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const rnd = rand(seed);

  g.fillStyle = mortar;
  g.fillRect(0, 0, size, size);

  const stone = CELL * fill;
  const r = stone * 0.18; // köşe yuvarlaklığı

  const drawStone = (cx, cy, color) => {
    const x = cx - stone / 2, y = cy - stone / 2;
    const path = () => {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + stone, y, x + stone, y + stone, r);
      g.arcTo(x + stone, y + stone, x, y + stone, r);
      g.arcTo(x, y + stone, x, y, r);
      g.arcTo(x, y, x + stone, y, r);
      g.closePath();
    };
    // Gövde: üst-sol açık, alt-sağ koyu (kabartma)
    const grad = g.createLinearGradient(x, y, x + stone, y + stone);
    grad.addColorStop(0, shade(color, 0.07));
    grad.addColorStop(0.55, color);
    grad.addColorStop(1, shade(color, -0.09));
    path();
    g.fillStyle = grad;
    g.fill();
    // İnce koyu kenar: derzle taşı ayırır
    g.lineWidth = 2;
    g.strokeStyle = shade(color, -0.14);
    g.stroke();
  };

  for (let row = 0; row < cells; row++) {
    const offset = (row % 2) * 0.5; // tuğla deseni — satırlar yarım kaydırılır
    for (let col = -1; col <= cells; col++) {
      const color = colors[Math.floor(rnd() * colors.length) % colors.length];
      const jx = (rnd() - 0.5) * jitter * CELL;
      const jy = (rnd() - 0.5) * jitter * CELL;
      const cx = (col + 0.5 + offset) * CELL + jx;
      const cy = (row + 0.5) * CELL + jy;
      drawStone(cx, cy, color);
      // Kenardan taşan taşı karşı kenara da çiz → doku dikişsiz tekrarlar
      if (cx - stone / 2 < 0) drawStone(cx + size, cy, color);
      if (cx + stone / 2 > size) drawStone(cx - size, cy, color);
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}
