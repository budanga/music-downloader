import { Howler } from 'howler'

/**
 * Real-time spectrum of what is playing. Howler plays through an <audio> element (html5 mode);
 * we route that element through a Web Audio AnalyserNode.
 *
 * The audio comes from the custom music:// protocol, a different origin from the page, so the
 * element must request it with CORS (the main process answers with
 * Access-Control-Allow-Origin). Without that, the analyser would read silence.
 */
let ctx: AudioContext | null = null
let analyser: AnalyserNode | null = null
const sources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>()

// Howler takes its <audio> elements from this pool; mark them as CORS requests before it sets src.
const H = Howler as unknown as { _obtainHtml5Audio: () => HTMLAudioElement }
const obtain = H._obtainHtml5Audio.bind(Howler)
H._obtainHtml5Audio = () => {
  const audio = obtain()
  audio.crossOrigin = 'anonymous'
  return audio
}

export function attachAnalyser(node: HTMLMediaElement): void {
  try {
    if (!ctx) {
      ctx = new AudioContext()
      analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.78
      analyser.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume()
    if (!sources.has(node) && analyser) {
      const source = ctx.createMediaElementSource(node)
      source.connect(analyser)
      sources.set(node, source)
    }
  } catch (e) {
    console.warn('Spectrum unavailable:', e)
  }
}

export const getAnalyser = (): AnalyserNode | null => analyser
