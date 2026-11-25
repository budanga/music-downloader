import type { Field } from '../motion/art'
import { smooth } from '../motion/kit'
import { DitherCanvas } from '../motion/Motion'

interface SectionCoverProps {
  title: string
  /** [value, label] pairs, e.g. [24, 'canciones'] */
  pills: Array<[string | number, string]>
  art: Field
  onBack?: () => void
  backLabel?: string
}

// Fade every illustration towards the sides so it sits centred in the cover and leaves the
// title readable. Cached per illustration so the cover can tell when the picture really changes.
const centred = new WeakMap<Field, Field>()
function centre(art: Field): Field {
  let f = centred.get(art)
  if (!f) {
    f = (u, v, t, a) => art(u, v, t, a) * (1 - smooth(1.05, 1.75, Math.abs((u - 0.5) * a)))
    centred.set(art, f)
  }
  return f
}

/**
 * The cover that opens every section: title, count pills and a dithered illustration centred
 * behind them. Changing section morphs the previous illustration into the new one.
 */
export default function SectionCover({ title, pills, art, onBack, backLabel }: SectionCoverProps) {
  return (
    <section className="cover">
      <div className="cover__art">
        <DitherCanvas field={centre(art)} px={3} fine memoryKey="section-cover" />
      </div>
      <div className="cover__txt">
        {onBack && (
          <button className="back" onClick={onBack}>
            ← {backLabel}
          </button>
        )}
        <h1>{title}</h1>
        <div className="stats">
          {pills.map(([value, label], i) => (
            <span className="stat" key={i}>
              <b>{value}</b> {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
