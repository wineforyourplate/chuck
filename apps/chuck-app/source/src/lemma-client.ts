import { LemmaClient } from 'lemma-sdk'

// Shared Lemma client for this app. In a deployed app the host injects
// window.__LEMMA_CONFIG__ (podId as a UUID, plus apiUrl/authUrl) at serve time —
// prefer it so the same build runs against local / staging / cloud unchanged. In
// dev there is no injected config, so fall back to .env.local (VITE_LEMMA_*).
// Note: the SDK addresses pods by UUID, so VITE_LEMMA_POD_ID must be the pod id.
const injected =
  (typeof window !== 'undefined' &&
    (window as unknown as {
      __LEMMA_CONFIG__?: { apiUrl?: string; authUrl?: string; podId?: string }
    }).__LEMMA_CONFIG__) ||
  {}

export const lemmaClient = new LemmaClient({
  apiUrl: injected.apiUrl || import.meta.env.VITE_LEMMA_API_URL,
  authUrl: injected.authUrl || import.meta.env.VITE_LEMMA_AUTH_URL,
  podId: injected.podId || import.meta.env.VITE_LEMMA_POD_ID,
})

// Dev-only escape hatch for debugging file/record APIs from the console.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __lemma?: unknown }).__lemma = lemmaClient
}
