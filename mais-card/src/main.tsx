import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// VITE_ROUTER=memory é usado no build hospedado como demo (sem URL por rota).
// Nesse modo, um "#quiz" no link abre o app direto naquela tela.
const memory = import.meta.env.VITE_ROUTER === 'memory'
const telaInicial = memory && /^#[a-z-]+$/.test(window.location.hash) ? '/' + window.location.hash.slice(1) : '/'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {memory ? (
      <MemoryRouter initialEntries={[telaInicial]}>
        <App />
      </MemoryRouter>
    ) : (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )}
  </StrictMode>,
)
