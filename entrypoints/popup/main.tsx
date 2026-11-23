import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./style.css";

if (window.parent !== window && new URLSearchParams(location.search).has("floating")) {
  document.documentElement.classList.add("embedded");
  window.addEventListener("keydown", event => {
    if (event.key === "Escape") window.parent.postMessage("bilianime-close-panel", "*");
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
