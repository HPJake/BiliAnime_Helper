import React from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

function App() {
  return (
    <main className="popup-shell">
      <header>
        <span className="brand-mark">B</span>
        <h1>BiliAnime Helper</h1>
      </header>
      <p className="subtitle">Your Bilibili anime dashboard</p>
      <section className="empty-state" aria-live="polite">
        <strong>Dashboard coming soon</strong>
        <span>Follow anime and view airing schedules here.</span>
      </section>
      <footer>Unofficial extension · v0.1.0</footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
