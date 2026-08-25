import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack)
    this.setState({ info })
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#080810', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: 14, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <h2 style={{ color: '#f59e0b', fontWeight: 700 }}>Ops, algo deu errado</h2>
          <pre style={{ color: '#ef4444', fontSize: 12, maxWidth: 600, textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <pre style={{ color: '#6b7280', fontSize: 10, maxWidth: 600, textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 300, overflow: 'auto' }}>
            {this.state.info?.componentStack || 'No stack trace'}
          </pre>
          <button onClick={() => window.location.reload()} className="ark-btn">
            🔄 Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
