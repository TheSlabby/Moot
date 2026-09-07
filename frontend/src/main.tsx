import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { initWs } from "./ws/bootstrap";

// Wire the WebSocket dispatch into the stores once, before render.
initWs();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
