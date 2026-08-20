import { useEffect, useState } from 'react';
import { getLang, onLangChange } from './index';

// Dil değiştiğinde bileşeni yeniden çizer.
export default function useLang() {
  const [lang, setLang] = useState(getLang);
  useEffect(() => onLangChange(setLang), []);
  return lang;
}
