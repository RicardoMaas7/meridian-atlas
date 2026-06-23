import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { configureLoader } from './parser/loader'
import { App } from './ui/App'
import { I18nProvider } from './i18n/context'

const wasmBase = `${import.meta.env.BASE_URL}wasm/`
configureLoader({
  grammarPath: (file) => wasmBase + file,
  runtimePath: (file) => wasmBase + file,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
