import { useEffect, useState } from 'react'
import styles from './AnimatedHead.module.css'

interface AnimatedHeadProps {
  isListening?: boolean
}

export function AnimatedHead({ isListening = false }: AnimatedHeadProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className={`${styles.wrap} ${mounted ? styles.visible : ''} ${isListening ? styles.listening : ''}`}>
      <svg
        viewBox="0 0 120 140"
        className={styles.head}
        aria-hidden
      >
        <defs>
          <linearGradient id="headGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.08" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Голова — овал */}
        <ellipse cx="60" cy="72" rx="42" ry="50" fill="url(#headGrad)" stroke="var(--accent)" strokeWidth="1.5" strokeOpacity="0.5" className={styles.face} />
        {/* Волосы/верх */}
        <path d="M22 45 Q60 28 98 45 L95 55 Q60 42 25 55 Z" fill="none" stroke="var(--accent)" strokeWidth="1" strokeOpacity="0.4" />
        {/* Левый глаз */}
        <ellipse cx="45" cy="68" rx="6" ry="8" fill="none" stroke="var(--accent)" strokeWidth="1.5" className={styles.eye} />
        <circle cx="45" cy="69" r="2.5" fill="var(--accent)" className={styles.pupil} />
        {/* Правый глаз */}
        <ellipse cx="75" cy="68" rx="6" ry="8" fill="none" stroke="var(--accent)" strokeWidth="1.5" className={styles.eye} />
        <circle cx="75" cy="69" r="2.5" fill="var(--accent)" className={styles.pupil} />
        {/* Рот — нейтральная линия, при listening приоткрыт через CSS */}
        <path d="M50 95 Q60 98 70 95" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" className={styles.mouth} />
      </svg>
    </div>
  )
}
