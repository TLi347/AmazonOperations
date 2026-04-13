import { useState, useRef, useCallback } from 'react'
import { triggerAnalysis, connectAnalysisStream } from '../api/client'
import type { AnalysisResult, AnalysisStreamEvent } from '../types/signals'

interface UseAnalysisReturn {
  isAnalyzing: boolean
  progress: AnalysisStreamEvent[]
  result: AnalysisResult | null
  startAnalysis: (asin: string) => void
  error: string | null
  reset: () => void
}

export function useAnalysis(): UseAnalysisReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState<AnalysisStreamEvent[]>([])
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const reset = useCallback(() => {
    setIsAnalyzing(false)
    setProgress([])
    setResult(null)
    setError(null)
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const startAnalysis = useCallback(async (asin: string) => {
    reset()
    setIsAnalyzing(true)

    try {
      const { task_id } = await triggerAnalysis(asin, true)

      const ws = connectAnalysisStream(task_id, {
        onStage: (stage, message) => {
          setProgress((prev) => [...prev, { stage, message }])
        },
        onComplete: (analysisResult) => {
          setResult(analysisResult)
          setIsAnalyzing(false)
        },
        onError: () => {
          setError('分析连接出错，请重试')
          setIsAnalyzing(false)
        },
        onClose: () => {
          setIsAnalyzing(false)
        },
      })

      wsRef.current = ws
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析启动失败')
      setIsAnalyzing(false)
    }
  }, [reset])

  return { isAnalyzing, progress, result, startAnalysis, error, reset }
}
