// Basit çeviri katmanı. Kaynak dil Türkçe: anahtar olarak Türkçe metnin
// kendisi kullanılır, böylece bileşenler okunaklı kalır ve çeviri eksikse
// oyun Türkçe metne düşer (boş/kırık metin görünmez).
//
// Kullanım:  t('BAŞLA')            → 'START'
//            t('{n} havuç', {n:5}) → '5 carrots'

import { EN } from './en';

const LANGS = ['tr', 'en'];

function detect() {
  const saved = (typeof localStorage !== 'undefined') && localStorage.getItem('lang');
  if (saved && LANGS.includes(saved)) return saved;
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'tr';
  return nav.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

let lang = detect();
const listeners = new Set();

export function getLang() { return lang; }

export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  lang = next;
  try { localStorage.setItem('lang', next); } catch (e) {}
  listeners.forEach(fn => fn(lang));
}

// Dil değişince yeniden çizilmesi gereken bileşenler buraya abone olur
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(str, vars) {
  let out = (lang === 'en' && EN[str] != null) ? EN[str] : str;
  if (vars) {
    for (const k of Object.keys(vars)) {
      out = out.split(`{${k}}`).join(String(vars[k]));
    }
  }
  return out;
}
