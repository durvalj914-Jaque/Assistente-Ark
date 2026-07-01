import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Mantém o log técnico no console para investigação futura, sem expor ao usuário.
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#080810', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: 14, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <h2 style={{ color: '#f59e0b', fontWeight: 700 }}>Ops, algo deu errado</h2>
          <p style={{ color: '#475569', fontSize: 13, maxWidth: 380 }}>
            Tivemos um problema ao carregar esta página. Tente recarregar — se persistir, fale com o suporte.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="ark-btn"
          >
            🔄 Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
