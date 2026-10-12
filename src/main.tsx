import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// SW нужен только в проде (офлайн-установка на планшет у станка). В dev он
// вредил бы: cache-first отдавал устаревшие модули Vite. Регистрируем относительный
// путь (BASE_URL → './' при base:'./'), чтобы работало и в корне, и на подпути gh-pages.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
      console.log('SW registration failed: ', error);
    });
  });
}

