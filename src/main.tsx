import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root")!;

// Sempre createRoot. O HTML prerenderizado serve como FCP boost + SEO/OG
// pra bots; o React substitui no client. Tentar hydrateRoot causava mismatch
// (#418/#423) porque o prerender resolve queries Supabase mas o cliente
// renderiza primeiro sem dados, divergindo do DOM esperado pela hidratacao.
createRoot(rootElement).render(<App />);
