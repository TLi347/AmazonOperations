import axios from 'axios'
import type {
  AnalysisResult,
  Product,
  ChatMessage,
} from '../types/signals'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export async function fetchProducts(): Promise<Product[]> {
  const res = await api.get<Product[]>('/products')
  return res.data
}

export async function fetchSignals(asin: string): Promise<AnalysisResult> {
  const res = await api.get<AnalysisResult>(`/products/${asin}/signals`)
  return res.data
}

export interface BrandShareItem {
  brand: string
  click_share: number
  delta: number
  is_self: boolean
}

export async function fetchBrandShare(asin: string): Promise<BrandShareItem[]> {
  const res = await api.get<BrandShareItem[]>(`/products/${asin}/brand-share`)
  return res.data
}

export async function triggerAnalysis(asin: string, forceRefresh = false): Promise<{ task_id: string }> {
  const res = await api.post<{ task_id: string }>('/analysis/product', { asin, force_refresh: forceRefresh })
  return res.data
}

export async function confirmDecision(
  asin: string,
  signalId: string,
  decision: 'confirm' | 'reject' | 'defer',
  note?: string
): Promise<void> {
  await api.post('/decisions/confirm', { asin, signal_id: signalId, decision, note })
}

export interface ChatContext {
  trigger_signal_id?: string
  trigger_signal_title?: string
  trigger_signal_priority?: string
  related_ad_groups?: string[]
  evidence_summary?: string
  reasoning?: string
  asin?: string
  current_acos?: number
  break_even_acos?: number
  stage?: string
  inventory_days?: number
  latest_p0_count?: number
  latest_p1_count?: number
}

export async function sendChat(
  prompt: string,
  context: ChatContext,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<{ reply: string }> {
  const asin = context.asin ?? ''
  const res = await api.post<{ reply: string }>('/chat', {
    asin,
    prompt,
    context,
    conversation_history: conversationHistory,
  })
  return res.data
}

export interface AnalysisStreamCallbacks {
  onStage: (stage: string, message: string) => void
  onComplete: (result: AnalysisResult) => void
  onError: (err: Event) => void
  onClose: () => void
}

export function connectAnalysisStream(
  taskId: string,
  callbacks: AnalysisStreamCallbacks
): WebSocket {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${protocol}://${location.host}/ws/analysis/${taskId}`)

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.stage === 'complete' && data.payload) {
        callbacks.onComplete(data.payload as AnalysisResult)
      } else {
        callbacks.onStage(data.stage, data.message)
      }
    } catch {
      // ignore parse errors
    }
  }

  ws.onerror = (err) => callbacks.onError(err)
  ws.onclose = () => callbacks.onClose()

  return ws
}

export interface ChatStreamCallbacks {
  onToken: (token: string) => void
  onDone: () => void
  onError: (err: Event) => void
}

export function connectChatStream(
  messages: ChatMessage[],
  context: object,
  callbacks: ChatStreamCallbacks
): WebSocket {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${protocol}://${location.host}/ws/chat`)

  ws.onopen = () => {
    ws.send(JSON.stringify({ messages, context }))
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.done) {
        callbacks.onDone()
      } else if (data.token) {
        callbacks.onToken(data.token)
      }
    } catch {
      // ignore parse errors
    }
  }

  ws.onerror = (err) => callbacks.onError(err)

  return ws
}

export default api
