import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Fontlar yüklenmeden çizme: oyun ortasında font değişimi (FOUT) olmasın.
// Türkçe harfler latin-ext dosyalarında → örnek metin onları da tetikler. En fazla 2,5 sn bekle.
const fontsReady = (() => {
  try {
    const sample = 'AaÇçĞğİıÖöŞşÜü';
    const loads = ['400 16px "Lilita One"', '700 16px Nunito', '800 16px Nunito', '900 16px Nunito']
      .map((f) => document.fonts.load(f, sample));
    return Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
  } catch { return Promise.resolve(); }
})();

fontsReady.then(() => createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
));
