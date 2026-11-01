import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// brand type, bundled with the app (no request to a font service)
import '@fontsource-variable/figtree';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
