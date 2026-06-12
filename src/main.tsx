import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { configureLoader } from './parser/loader'
import { App } from './ui/App'

// Resolve grammars relative to wherever the app is served from, so the chart
// works at a domain root and under a subpath (GitHub Pages) alike.
const wasmBase = `${import.meta.env.BASE_URL}wasm/`
configureLoader({
  grammarPath: (file) => wasmBase + file,
  runtimePath: (file) => wasmBase + file,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
