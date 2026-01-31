import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode disabled to prevent double API calls during development
// Re-enable for production builds
createRoot(document.getElementById('root')!).render(
  <App />
)
