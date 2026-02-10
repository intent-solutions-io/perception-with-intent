import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db, auth } from '../firebase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, BellIcon } from '@/components/EmptyState'

interface Alert {
  id: string
  name?: string
  type?: string
  status?: 'active' | 'disabled'
  condition?: string
  threshold?: number
  lastTriggered?: { seconds: number }
  triggerCount?: number
}

function AlertsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Alerts & Thresholds</CardTitle>
          <div className="flex gap-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="p-4 border border-border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
            </div>
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function AlertsCard() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const user = auth.currentUser
        if (!user) {
          setError('Not authenticated')
          setLoading(false)
          return
        }

        const alertsRef = collection(db, 'users', user.uid, 'alerts')
        const snapshot = await getDocs(alertsRef)

        const alertsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as Alert[]

        setAlerts(alertsList)
      } catch (err) {
        console.error('Error fetching alerts:', err)
        setError(err instanceof Error ? err.message : 'Failed to load alerts')
      } finally {
        setLoading(false)
      }
    }

    fetchAlerts()
  }, [])

  if (loading) {
    return <AlertsSkeleton />
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Alerts & Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Error loading alerts: {error}</p>
        </CardContent>
      </Card>
    )
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Alerts & Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<BellIcon />}
            title="No alerts configured"
            description="Set up alerts to get notified about important conditions and threshold breaches."
          />
        </CardContent>
      </Card>
    )
  }

  const activeAlerts = alerts.filter((a) => a.status === 'active')
  const disabledAlerts = alerts.filter((a) => a.status === 'disabled')

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Alerts & Thresholds</CardTitle>
          <div className="flex gap-3 text-sm">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
              {activeAlerts.length} active
            </span>
            <span className="text-muted-foreground tabular-nums">
              {disabledAlerts.length} disabled
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 border rounded-lg transition-all ${
                alert.status === 'active'
                  ? 'border-border hover:border-border/80 hover:shadow-sm bg-card'
                  : 'border-border/50 bg-muted/30'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-foreground">
                      {alert.name || alert.id}
                    </h4>
                    <div
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        alert.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                      }`}
                      title={alert.status}
                    />
                  </div>
                  {alert.condition && (
                    <p className="text-sm text-muted-foreground mt-1">{alert.condition}</p>
                  )}
                  {alert.threshold !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                      Threshold: {alert.threshold}
                    </p>
                  )}
                </div>
                {alert.type && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    {alert.type}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                {alert.triggerCount !== undefined && (
                  <span className="tabular-nums">Triggered {alert.triggerCount} times</span>
                )}
                {alert.lastTriggered && (
                  <span>
                    Last: {new Date(alert.lastTriggered.seconds * 1000).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
