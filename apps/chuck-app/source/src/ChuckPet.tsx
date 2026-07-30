import { useEffect, useState } from 'react'
import chuckIcon from './assets/chuck-icon.webp'
import failedStrip from './assets/chuck-failed.webp'
import idleStrip from './assets/chuck-idle.webp'
import jumpingStrip from './assets/chuck-jumping.webp'
import reviewStrip from './assets/chuck-review.webp'
import runningStrip from './assets/chuck-running.webp'
import waitingStrip from './assets/chuck-waiting.webp'
import wavingStrip from './assets/chuck-waving.webp'

const FRAME_WIDTH = 64
const FRAME_HEIGHT = 69

export type ChuckPetState =
  | 'idle'
  | 'waving'
  | 'jumping'
  | 'failed'
  | 'waiting'
  | 'running'
  | 'review'

const animations: Record<ChuckPetState, { image: string; durations: number[] }> = {
  idle: { image: idleStrip, durations: [280, 110, 110, 140, 140, 320] },
  waving: { image: wavingStrip, durations: [140, 140, 140, 280] },
  jumping: { image: jumpingStrip, durations: [140, 140, 140, 140, 280] },
  failed: { image: failedStrip, durations: [140, 140, 140, 140, 140, 140, 140, 240] },
  waiting: { image: waitingStrip, durations: [150, 150, 150, 150, 150, 260] },
  running: { image: runningStrip, durations: [120, 120, 120, 120, 120, 220] },
  review: { image: reviewStrip, durations: [150, 150, 150, 150, 150, 280] },
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return reduced
}

export function ChuckPet({
  state = 'idle',
  size = 64,
  className = '',
  animate = true,
  loop = true,
}: {
  state?: ChuckPetState
  size?: number
  className?: string
  animate?: boolean
  loop?: boolean
}) {
  const animation = animations[state]
  const reducedMotion = useReducedMotion()
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    setFrame(0)
  }, [state, reducedMotion])

  useEffect(() => {
    const lastFrame = animation.durations.length - 1
    if (!animate || reducedMotion || (!loop && frame === lastFrame)) return
    const timer = window.setTimeout(
      () => setFrame((current) => loop
        ? (current + 1) % animation.durations.length
        : Math.min(current + 1, lastFrame)),
      animation.durations[frame],
    )
    return () => window.clearTimeout(timer)
  }, [animate, animation, frame, loop, reducedMotion])

  const scale = size / FRAME_WIDTH

  return (
    <span
      className={`chuck-pet ${className}`.trim()}
      style={{ width: size, height: FRAME_HEIGHT * scale }}
      aria-hidden="true"
    >
      <span
        className="chuck-pet__atlas"
        style={{
          backgroundImage: `url(${animation.image})`,
          backgroundSize: `${animation.durations.length * FRAME_WIDTH}px ${FRAME_HEIGHT}px`,
          backgroundPosition: `${-frame * FRAME_WIDTH}px 0`,
          transform: `scale(${scale})`,
        }}
      />
    </span>
  )
}

export function ChuckIcon({
  size = 16,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <img
      className={`chuck-icon ${className}`.trim()}
      src={chuckIcon}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
  )
}

export function ChuckSplash({
  message = 'Finding your mind palace.',
  detail = 'Putting everything back where you left it.',
}: {
  message?: string
  detail?: string
}) {
  return (
    <main className="chuck-splash ui" role="status" aria-live="polite">
      <div className="chuck-splash__brand">
        <span className="brand-dot" />
        <span>Chuck</span>
      </div>
      <ChuckPet state="running" size={64} className="chuck-splash__pet" />
      <h1>{message}</h1>
      <p>{detail}</p>
    </main>
  )
}
