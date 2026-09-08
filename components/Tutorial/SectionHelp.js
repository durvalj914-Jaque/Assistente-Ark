import { useState } from 'react'
import TutorialModal from './TutorialModal'
import { SECTION_TUTORIALS } from '../../lib/sectionTutorials'

/**
 * "?" na frente de subtítulos: abre o tutorial detalhado daquela seção,
 * com foco em como automatizar. Uso: <SectionHelp t="marketing" s="enviar" />
 */
export default function SectionHelp({ t, s }) {
  const [open, setOpen] = useState(false)
  const tutorial = SECTION_TUTORIALS[`${t}:${s}`]

  if (!tutorial) return null

  return (
    <span style={{ display: 'inline-flex', marginLeft: 6, verticalAlign: 'middle' }}>
      <button type="button" onClick={() => setOpen(true)} title={`Como usar: ${tutorial.title}`}
        style={{
          width: 18, height: 18, borderRadius: '50%', border: '1px solid rgba(79,142,247,0.4)',
          background: 'rgba(79,142,247,0.1)', color: '#4f8ef7',
          fontSize: 11, fontWeight: 800, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1, padding: 0,
        }}>
        ?
      </button>
      {open && <TutorialModal tutorial={tutorial} onClose={() => setOpen(false)} />}
    </span>
  )
}
