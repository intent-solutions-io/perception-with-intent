import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ChartBarIcon } from '@/components/EmptyState'

interface Source {
  id: string
  name: string
  type: string
  url: string
  category: string
  status: 'active' | 'disabled'
  lastChecked?: { seconds: number }
  lastSuccess?: { seconds: number }
  articlesLast24h?: number
}

interface SourceStats {
  total: number
  active: number
  disabled: number
  byCategory: Record<string, number>
  byType: Record<string, number>
}

function SourcesSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Source Health & Coverage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center p-3 bg-muted/50 rounded-lg">
              <Skeleton className="h-8 w-12 mx-auto mb-1" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-2 flex-1" />
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function SourceHealthCard() {
  const [sources, setSources] = useState<Source[]>([])
  const [stats, setStats] = useState<SourceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSources = async () => {
      try {
        const sourcesRef = collection(db, 'sources')
        const snapshot = await getDocs(sourcesRef)

        const sourcesList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as Source[]

        setSources(sourcesList)

        // Calculate stats
        const stats: SourceStats = {
          total: sourcesList.length,
          active: sourcesList.filter((s) => s.status === 'active').length,
          disabled: sourcesList.filter((s) => s.status === 'disabled').length,
          byCategory: {},
          byType: {}
        }

        sourcesList.forEach((source) => {
          stats.byCategory[source.category] = (stats.byCategory[source.category] || 0) + 1
          stats.byType[source.type] = (stats.byType[source.type] || 0) + 1
        })

        setStats(stats)
      } catch (err) {
        console.error('Error fetching sources:', err)
        setError(err instanceof Error ? err.message : 'Failed to load sources')
      } finally {
        setLoading(false)
      }
    }

    fetchSources()
  }, [])

  if (loading) {
    return <SourcesSkeleton />
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Source Health & Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Error loading sources: {error}</p>
        </CardContent>
      </Card>
    )
  }

  if (sources.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Source Health & Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<ChartBarIcon />}
            title="No sources configured"
            description="Sources are managed through the ingestion system."
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-testid="sources-card">
      <CardHeader>
        <CardTitle>Source Health & Coverage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-semibold text-foreground tabular-nums">{stats.total}</div>
              <div className="text-xs text-muted-foreground mt-1">Total Sources</div>
            </div>
            <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{stats.active}</div>
              <div className="text-xs text-muted-foreground mt-1">Active</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-semibold text-muted-foreground tabular-nums">{stats.disabled}</div>
              <div className="text-xs text-muted-foreground mt-1">Disabled</div>
            </div>
          </div>
        )}

        {/* Category Breakdown */}
        {stats && Object.keys(stats.byCategory).length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">By Category</h4>
            <div className="space-y-2.5">
              {Object.entries(stats.byCategory)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([category, count]) => (
                  <div key={category} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground capitalize w-24 truncate">{category}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${(count / stats.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-foreground w-8 text-right tabular-nums">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Source List */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Recent Sources</h4>
          <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin">
            {sources.slice(0, 10).map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between p-2.5 hover:bg-muted/50 rounded-lg transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{source.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {source.category} • {source.type}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {source.articlesLast24h !== undefined && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {source.articlesLast24h} today
                    </span>
                  )}
                  <div
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                      source.status === 'active'
                        ? 'bg-emerald-500'
                        : 'bg-muted-foreground/30'
                    }`}
                    title={source.status}
                  />
                </div>
              </div>
            ))}
            {sources.length > 10 && (
              <div className="text-center text-xs text-muted-foreground pt-2">
                +{sources.length - 10} more sources
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
