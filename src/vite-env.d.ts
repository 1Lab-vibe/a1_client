/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_N8N_WEBHOOK_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

declare var SpeechRecognition: new () => SpeechRecognitionInstance
declare var webkitSpeechRecognition: new () => SpeechRecognitionInstance

interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
}
