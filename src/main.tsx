import { createRoot } from "react-dom/client";
import { App } from "./App";
import { SessionProvider } from "./lib/session";
import { ToastProvider } from "./lib/toast";
import { initTelegramChrome } from "./lib/telegram";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/screens.css";
import "./styles/admin.css";

initTelegramChrome();

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <ToastProvider>
    <SessionProvider>
      <App />
    </SessionProvider>
  </ToastProvider>,
);
