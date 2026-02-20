import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

const MCP_URL = 'https://perception-mcp-w53xszfqnq-uc.a.run.app'

type RunPhase =
  | 'idle'
  | 'starting'
  | 'accepted'
  | 'initializing'
  | 'loading_sources'
  | 'fetching_feeds'
  | 'storing_articles'
  | 'upserting_authors'
  | 'done'

const PHASE_LABELS: Record<string, string> = {
  starting: 'Starting...',
  initializing: 'Starting...',
  accepted: 'Starting...',
  loading_sources: 'Loading sources...',
  fetching_feeds: 'Fetching feeds...',
  storing_articles: 'Storing articles...',
  upserting_authors: 'Upserting authors...',
  done: 'Finishing up...',
}

const POLL_INTERVAL_MS = 3000
const STUCK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

export default function IngestionButton() {
  const [phase, setPhase] = useState<RunPhase>('idle')
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef<number>(0)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  const handleComplete = useCallback(
    (data: {
      status: string
      stats?: Record<string, number>
      errors?: Array<{ message: string }>
      is_successful?: boolean
    }) => {
      stopPolling()
      setPhase('idle')
      setStats(null)

      const stored = data.stats?.articlesStored || 0
      const sources = data.stats?.sourcesChecked || 0
      const errorCount = data.errors?.length || 0

      if (data.status === 'failed') {
        toast.error('Ingestion failed', {
          description: data.errors?.[0]?.message || 'Check logs for details',
        })
      } else if (errorCount > 0) {
        toast.success(
          `Stored ${stored} articles from ${sources} sources`,
          {
            description: `${errorCount} source${errorCount > 1 ? 's' : ''} had errors`,
          }
        )
      } else {
        toast.success(
          `Stored ${stored} articles from ${sources} sources`,
          {
            description: `Completed successfully`,
          }
        )
      }

      // Notify SystemActivityCard to refresh
      window.dispatchEvent(new CustomEvent('ingestion-complete'))
    },
    [stopPolling]
  )

  const pollStatus = useCallback(
    (runId: string) => {
      const poll = async () => {
        // Stuck run detection
        if (Date.now() - startTimeRef.current > STUCK_TIMEOUT_MS) {
          stopPolling()
          setPhase('idle')
          setStats(null)
          toast.warning('Ingestion may be stuck', {
            description: 'The run has been active for over 5 minutes. Check Cloud Run logs.',
          })
          return
        }

        try {
          const res = await fetch(`${MCP_URL}/trigger/ingestion/${runId}`)
          if (!res.ok) {
            // Retry on next poll
            pollRef.current = setTimeout(poll, POLL_INTERVAL_MS)
            return
          }

          const data = await res.json()

          // Update phase display
          if (data.phase && data.phase !== 'done') {
            setPhase(data.phase as RunPhase)
          }

          // Update stats for display
          if (data.stats) {
            setStats(data.stats)
          }

          // Check for terminal state
          if (
            data.status === 'completed' ||
            data.status === 'completed_with_errors' ||
            data.status === 'failed'
          ) {
            handleComplete(data)
            return
          }
        } catch {
          // Network error - keep polling, might recover
        }

        // Schedule next poll only after current one completes
        pollRef.current = setTimeout(poll, POLL_INTERVAL_MS)
      }

      // Start first poll after delay
      pollRef.current = setTimeout(poll, POLL_INTERVAL_MS)
    },
    [stopPolling, handleComplete]
  )

  // Listen for auto-ingestion started by useAutoIngestion hook
  useEffect(() => {
    const handler = (e: Event) => {
      const runId = (e as CustomEvent<{ run_id: string }>).detail.run_id
      if (phase === 'idle' && runId) {
        setPhase('starting')
        startTimeRef.current = Date.now()
        pollStatus(runId)
      }
    }
    window.addEventListener('auto-ingestion-started', handler)
    return () => window.removeEventListener('auto-ingestion-started', handler)
  }, [phase, pollStatus])

  const handleRunIngestion = async () => {
    setPhase('starting')
    startTimeRef.current = Date.now()

    try {
      const response = await fetch(`${MCP_URL}/trigger/ingestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger: 'manual',
          time_window_hours: 24,
          max_items_per_source: 50,
        }),
      })

      if (response.status === 409) {
        const data = await response.json()
        setPhase('idle')
        toast.warning('Ingestion already in progress', {
          description: `Run ${data.detail?.active_run_id || ''} is still active. Wait for it to finish.`,
        })
        return
      }

      if (response.status === 202) {
        const data = await response.json()
        toast.info('Ingestion started', {
          description: `Run ID: ${data.run_id}`,
        })
        pollStatus(data.run_id)
        return
      }

      // Unexpected status
      setPhase('idle')
      toast.warning('Ingestion service unavailable', {
        description: 'The MCP service may be restarting. Try again in a moment.',
      })
    } catch {
      setPhase('idle')
      toast.error('Failed to connect to ingestion service', {
        description: 'Check your network connection and try again.',
      })
    }
  }

  const isRunning = phase !== 'idle'
  const phaseLabel = PHASE_LABELS[phase] || 'Processing...'

  return (
    <div className="flex flex-col gap-1">
      <Button
        onClick={handleRunIngestion}
        disabled={isRunning}
        className="w-full sm:w-auto"
      >
        {isRunning ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            {phaseLabel}
          </>
        ) : (
          'Run Ingestion'
        )}
      </Button>
      {isRunning && stats && (
        <span className="text-xs text-muted-foreground">
          {stats.articlesFetched !== undefined &&
            `${stats.articlesFetched} articles fetched`}
          {stats.articlesStored !== undefined &&
            stats.articlesStored > 0 &&
            ` · ${stats.articlesStored} stored`}
        </span>
      )}
    </div>
  )
}
