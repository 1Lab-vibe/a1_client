/**
 * HMAC подпись запросов/ответов: payload → body_b64, signing_string = timestamp.nonce.body_b64, signature = HMAC_SHA256(secret, signing_string) → base64.
 * Секрет: VITE_A1_WEBHOOK_SECRET в .env (клиент).
 */

function strToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export function base64ToStr(b64: string): string {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

async function hmacSha256Base64(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return arrayBufferToBase64(sig)
}

export interface SignedPayload {
  body_b64: string
  timestamp: number
  nonce: string
  signature: string
}

/**
 * Подписать payload для запроса: body_b64 + заголовки timestamp, nonce, signature.
 */
export async function signPayload(secret: string, payload: object): Promise<SignedPayload> {
  const jsonStr = JSON.stringify(payload)
  const body_b64 = strToBase64(jsonStr)
  const timestamp = Math.floor(Date.now() / 1000)
  const nonce = crypto.randomUUID()
  const signingString = `${timestamp}.${nonce}.${body_b64}`
  const signature = await hmacSha256Base64(secret, signingString)
  return { body_b64, timestamp, nonce, signature }
}

/**
 * Проверить подпись ответа и вернуть расшифрованный payload; при несовпадении — null.
 */
export async function verifySignedResponse(
  secret: string,
  body_b64: string,
  timestamp: string,
  nonce: string,
  signature: string
): Promise<object | null> {
  const signingString = `${timestamp}.${nonce}.${body_b64}`
  const expectedSig = await hmacSha256Base64(secret, signingString)
  if (expectedSig !== signature) return null
  try {
    const jsonStr = base64ToStr(body_b64)
    return JSON.parse(jsonStr) as object
  } catch {
    return null
  }
}
