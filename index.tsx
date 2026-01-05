// 【四】一次性清理污染的 URL 参数
(function cleanUrlOnce() {
  const url = new URL(window.location.href);
  if (url.searchParams.has('v') || url.searchParams.has('t')) {
    url.searchParams.delete('v');
    url.searchParams.delete('t');
    window.history.replaceState({}, '', url.pathname);
    console.log('🧹 已清理污染的 URL 参数');
  }
})();

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './src/sw-register';
import './src/index.css'; // Tailwind CSS

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
