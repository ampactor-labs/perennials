import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/app.css";
import "./styles/detail.css";

// Keep the installed app fresh without nagging — swap in updates on next load.
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
