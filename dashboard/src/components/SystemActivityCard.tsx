import { useEffect, useState } from 'react'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ChartBarIcon } from '@/components/EmptyState'

interface IngestionRun {
  id: string
  startedAt: { seconds: number }
  completedAt?: { seconds: number }
  status: 'completed' | 'running' | 'failed'
  trigger: string
  stats?: {
    sourcesChecked?: number
    sourcesFailed?: number
    articlesIngested?: number
    articlesDeduplicated?: number
    briefsGenerated?: number
    alertsTriggered?: number
  }
  duration?: number
}

function ActivitySkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 border border-border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-3 w-40 mb-3" />
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
              {[1, 2, 3].map((j) => (
                <div key={j} className="space-y-1">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-4 w-8" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function SystemActivityCard() {
  const [runs, setRuns] = useState<IngestionRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRuns = async () => {
      try {
        const runsRef = collection(db, 'ingestion_runs')
        const q = query(runsRef, orderBy('startedAt', 'desc'), limit(10))
        const snapshot = await getDocs(q)

        const runsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as IngestionRun[]

        setRuns(runsList)
      } catch (err) {
        console.error('Error fetching ingestion runs:', err)
        setError(err instanceof Error ? err.message : 'Failed to load activity')
      } finally {
        setLoading(false)
      }
    }

    fetchRuns()
  }, [])

  if (loading) {
    return <ActivitySkeleton />
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">System Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Error loading activity: {error}</p>
        </CardContent>
      </Card>
    )
  }

  if (runs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<ChartBarIcon />}
            title="No ingestion runs yet"
            description="Run your first ingestion to see activity logs and statistics."
          />
        </CardContent>
      </Card>
    )
  }

  const formatDate = (seconds: number) => {
    const date = new Date(seconds * 1000)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-'
    if (seconds < 60) return `${seconds}s`
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  }

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'completed':
        return 'default'
      case 'running':
        return 'secondary'
      case 'failed':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {runs.map((run) => (
            <div
              key={run.id}
              className="p-4 border border-border rounded-lg hover:border-border/80 hover:bg-muted/30 transition-all"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {formatDate(run.startedAt.seconds)}
                    </span>
                    <Badge variant={getStatusVariant(run.status)} className="text-xs">
                      {run.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Trigger: {run.trigger} • Duration: {formatDuration(run.duration)}
                  </div>
                </div>
              </div>

              {run.stats && (
                <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-border">
                  {run.stats.sourcesChecked !== undefined && (
                    <div>
                      <div className="text-xs text-muted-foreground">Sources</div>
                      <div className="text-sm font-medium text-foreground tabular-nums">
                        {run.stats.sourcesChecked}
                        {run.stats.sourcesFailed ? (
                          <span className="text-destructive text-xs ml-1">
                            ({run.stats.sourcesFailed} failed)
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )}
                  {run.stats.articlesIngested !== undefined && (
                    <div>
                      <div className="text-xs text-muted-foreground">Articles</div>
                      <div className="text-sm font-medium text-foreground tabular-nums">
                        {run.stats.articlesIngested}
                        {run.stats.articlesDeduplicated ? (
                          <span className="text-muted-foreground text-xs ml-1">
                            (-{run.stats.articlesDeduplicated})
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )}
                  {run.stats.briefsGenerated !== undefined && (
                    <div>
                      <div className="text-xs text-muted-foreground">Briefs</div>
                      <div className="text-sm font-medium text-foreground tabular-nums">
                        {run.stats.briefsGenerated}
                      </div>
                    </div>
                  )}
                  {run.stats.alertsTriggered !== undefined && run.stats.alertsTriggered > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground">Alerts</div>
                      <div className="text-sm font-medium text-amber-600 dark:text-amber-400 tabular-nums">
                        {run.stats.alertsTriggered}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {runs.length >= 10 && (
          <div className="text-center text-xs text-muted-foreground mt-4">
            Showing most recent 10 runs
          </div>
        )}
      </CardContent>
    </Card>
  )
}
