import { useState, useCallback, useEffect } from 'react'
import { confirmDecision as apiConfirmDecision } from '../api/client'

export type DecisionType = 'confirm' | 'reject' | 'defer'

export interface DecisionEntry {
  id: string
  asin: string
  signal_id: string
  decision: DecisionType
  note?: string
  timestamp: string
}

interface UseDecisionLogReturn {
  decisions: DecisionEntry[]
  confirmDecision: (asin: string, signalId: string, note?: string) => Promise<void>
  rejectDecision: (asin: string, signalId: string, note?: string) => Promise<void>
  deferDecision: (asin: string, signalId: string, note?: string) => Promise<void>
}

const STORAGE_KEY = 'openclaw_decision_log'

function loadFromStorage(): DecisionEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(entries: DecisionEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // ignore storage errors
  }
}

export function useDecisionLog(): UseDecisionLogReturn {
  const [decisions, setDecisions] = useState<DecisionEntry[]>(loadFromStorage)

  useEffect(() => {
    saveToStorage(decisions)
  }, [decisions])

  const logDecision = useCallback(
    async (
      asin: string,
      signalId: string,
      decision: DecisionType,
      note?: string
    ) => {
      const entry: DecisionEntry = {
        id: `${asin}_${signalId}_${Date.now()}`,
        asin,
        signal_id: signalId,
        decision,
        note,
        timestamp: new Date().toISOString(),
      }

      setDecisions((prev) => [entry, ...prev])

      try {
        await apiConfirmDecision(asin, signalId, decision, note)
      } catch {
        // best-effort sync; local log is always updated
      }
    },
    []
  )

  const confirmDecision = useCallback(
    (asin: string, signalId: string, note?: string) =>
      logDecision(asin, signalId, 'confirm', note),
    [logDecision]
  )

  const rejectDecision = useCallback(
    (asin: string, signalId: string, note?: string) =>
      logDecision(asin, signalId, 'reject', note),
    [logDecision]
  )

  const deferDecision = useCallback(
    (asin: string, signalId: string, note?: string) =>
      logDecision(asin, signalId, 'defer', note),
    [logDecision]
  )

  return { decisions, confirmDecision, rejectDecision, deferDecision }
}
