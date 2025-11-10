import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { SystemCustomizationProvider } from './contexts/SystemCustomizationContext'

// Aplicar tema salvo imediatamente ao carregar
const savedTheme = localStorage.getItem('theme');
if (savedTheme && savedTheme !== 'light') {
  document.documentElement.classList.add(savedTheme);
}

createRoot(document.getElementById("root")!).render(
  <SystemCustomizationProvider>
    <App />
  </SystemCustomizationProvider>
);
