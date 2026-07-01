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
    console.error('[ErrorBoundary]', error, info)
    this.setState({ info })
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#080810', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: 12, padding: 24, fontFamily: 'monospace' }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <h2 style={{ color: '#f59e0b' }}>Algo quebrou</h2>
          <pre style={{ color: '#ef4444', maxWidth: 600, whiteSpace: 'pre-wrap', fontSize: 12, textAlign: 'left', background: '#12121f', padding: 12, borderRadius: 8 }}>
            {String(this.state.error?.message || this.state.error)}
            {'\n\n'}
            {this.state.error?.stack || ''}
            {'\n\n'}
            {this.state.info?.componentStack || ''}
          </pre>
          <button onClick={() => window.location.href = '/admin'} style={{ background: '#4f8ef7', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}>
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
