/// <reference types="vite-plugin-pwa/client" />
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker: precachea la app completa para que funcione en modo avión.
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onOfflineReady() {
      const el = document.createElement('div');
      el.setAttribute('role', 'status');
      el.textContent = '✓ Pahtli ya funciona sin internet';
      el.style.cssText = 'position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 56px);transform:translateX(-50%);z-index:100;background:#1c1917;color:#fff;padding:12px 18px;border-radius:999px;font:600 15px/1.2 -apple-system,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)';
      document.body.appendChild(el);
      window.setTimeout(() => el.remove(), 3500);
    },
    onRegisterError(e) { console.error('[sw]', e); },
  });
}
