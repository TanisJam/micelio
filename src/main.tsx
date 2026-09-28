import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App.tsx'
// Self-hosted fonts (P5/P6): one display serif (Fraunces, for headings) and
// one UI sans (Inter, for body/chrome text) -- without these, both
// `ui.fontDisplay`/`ui.fontBody` fall back to a generic system serif/sans,
// which on most platforms renders as a plain Times-like serif.
import '@fontsource/fraunces/500.css'
import '@fontsource/fraunces/600.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import './index.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element #root not found')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
