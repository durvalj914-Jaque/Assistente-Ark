import { useState, useRef, useEffect } from 'react'

// Ícone "ⓘ" pequeno que mostra uma explicação em popover ao clicar — usado do
// lado de campos/botões pra explicar pra que servem, sem poluir a tela.
export default function HelpTip({ text }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block', marginLeft: 6 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: 16, height: 16, borderRadius: '50%', border: '1px solid rgba(79,142,247,0.4)',
          background: open ? 'rgba(79,142,247,0.25)' : 'rgba(79,142,247,0.1)', color: '#4f8ef7',
          fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0, verticalAlign: 'middle',
        }}
      >
        ?
      </button>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 250, top: 22, left: 0, width: 240,
          background: '#12121f', border: '1px solid rgba(79,142,247,0.3)', borderRadius: 8,
          padding: '10px 12px', fontSize: 12, lineHeight: 1.5, color: '#cbd5e1',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)', fontWeight: 400,
        }}>
          {text}
        </div>
      )}
    </span>
  )
}
