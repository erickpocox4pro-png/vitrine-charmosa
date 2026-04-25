import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root")!;

// If the root element has prerendered content (from prerender.mjs),
// hydrate it instead of replacing it. Otherwise, do a normal client render.
if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, <App />);
} else {
  createRoot(rootElement).render(<App />);
}
