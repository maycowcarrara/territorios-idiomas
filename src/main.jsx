import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.jsx'
import 'leaflet/dist/leaflet.css'

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      errorMessage: ''
    }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message ? String(error.message) : ''
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Erro ao carregar a aplicação:', error, errorInfo)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Carregamento interrompido</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-800">O app não conseguiu abrir por completo.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Em alguns navegadores, extensões de privacidade ou bloqueadores de anúncios podem impedir o carregamento de
            arquivos necessários.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Se você usa AdBlock, uBlock, Brave Shields ou similar, tente liberar este site e recarregar.
          </p>
          {this.state.errorMessage ? (
            <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Detalhe técnico: {this.state.errorMessage}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700"
          >
            Recarregar app
          </button>
        </div>
      </div>
    )
  }
}

const limparCachesOfflineLegados = async () => {
  if (typeof window === 'undefined' || !('caches' in window)) return

  try {
    const cacheNames = await window.caches.keys()
    const cachesOffline = cacheNames.filter((cacheName) => cacheName.includes('offline-map'))
    await Promise.all(cachesOffline.map((cacheName) => window.caches.delete(cacheName)))
  } catch (error) {
    console.warn('Não foi possível limpar caches offline antigos:', error)
  }
}

const prepararPwa = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  await limparCachesOfflineLegados()

  if (Capacitor.isNativePlatform()) return

  try {
    const { registerSW } = await import('virtual:pwa-register')
    registerSW({ immediate: true })
  } catch (error) {
    console.warn('Não foi possível registrar o service worker da PWA:', error)
  }
}

prepararPwa()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)

if (typeof window !== 'undefined' && typeof window.__MARK_APP_BOOTED__ === 'function') {
  window.__MARK_APP_BOOTED__()
}
