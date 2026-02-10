import { useEffect, useState } from 'react'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { cleanText } from '../utils/text'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, NewspaperIcon } from '@/components/EmptyState'

interface BriefSection {
  section_name: string
  key_points: string[]
  top_articles: {
    title: string
    source_id: string
    relevance_score: number
    url: string
  }[]
}

interface Brief {
  id: string
  date: string
  headline?: string
  sections?: BriefSection[]
  meta?: {
    article_count: number
    section_count: number
  }
  executiveSummary?: string
  highlights?: string[]
  metrics?: {
    articleCount: number
    topSources?: Record<string, number>
    mainTopics?: string[]
  }
}

function BriefSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Skeleton className="h-4 w-3/4" />
        <div className="space-y-3">
          <Skeleton className="h-6 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
        <div className="flex gap-6 pt-4 border-t border-border">
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-12" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-12" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function TodayBriefCard() {
  const [brief, setBrief] = useState<Brief | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchBrief = async () => {
      try {
        const briefsRef = collection(db, 'briefs')
        const q = query(briefsRef, orderBy('date', 'desc'), limit(1))
        const snapshot = await getDocs(q)

        if (!snapshot.empty) {
          const doc = snapshot.docs[0]
          setBrief({
            id: doc.id,
            ...doc.data()
          } as Brief)
        }
      } catch (err) {
        console.error('Error fetching brief:', err)
        setError(err instanceof Error ? err.message : 'Failed to load brief')
      } finally {
        setLoading(false)
      }
    }

    fetchBrief()
  }, [])

  if (loading) {
    return <BriefSkeleton />
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Today's Brief</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Error loading brief: {error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!brief) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today's Brief</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<NewspaperIcon />}
            title="No brief available yet"
            description="Daily briefs are generated during ingestion runs. Run an ingestion to generate today's brief."
          />
        </CardContent>
      </Card>
    )
  }

  // Handle new format (sections-based)
  if (brief.sections && brief.sections.length > 0) {
    return (
      <Card data-testid="brief-card">
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle>Today's Brief</CardTitle>
            <span className="text-sm text-muted-foreground">{brief.date}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Headline */}
          {brief.headline && (
            <p className="text-foreground font-medium leading-relaxed">
              {cleanText(brief.headline)}
            </p>
          )}

          {/* Sections */}
          {brief.sections.map((section, idx) => (
            <div key={idx} className="space-y-3">
              <Badge variant="secondary" className="font-medium">
                {section.section_name}
              </Badge>

              {/* Key Points */}
              <ul className="space-y-2">
                {section.key_points.slice(0, 5).map((point, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary font-bold shrink-0">•</span>
                    <span className="text-muted-foreground text-sm">{cleanText(point)}</span>
                  </li>
                ))}
              </ul>

              {/* Top Articles */}
              {section.top_articles && section.top_articles.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-2 font-medium">Top Stories</div>
                  <div className="space-y-2">
                    {section.top_articles.slice(0, 3).map((article, i) => (
                      <a
                        key={i}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm text-primary hover:text-primary/80 hover:underline truncate transition-colors"
                      >
                        {article.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Meta */}
          {brief.meta && (
            <div className="border-t border-border pt-4">
              <div className="flex gap-8">
                <div>
                  <div className="text-xs text-muted-foreground">Articles</div>
                  <div className="text-2xl font-semibold text-foreground tabular-nums">
                    {brief.meta.article_count}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Sections</div>
                  <div className="text-2xl font-semibold text-foreground tabular-nums">
                    {brief.meta.section_count}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Handle old format (executiveSummary-based)
  return (
    <Card data-testid="brief-card">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle>Today's Brief</CardTitle>
          <span className="text-sm text-muted-foreground">{brief.date}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Executive Summary */}
        {brief.executiveSummary && (
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">Executive Summary</h4>
            <p className="text-muted-foreground leading-relaxed">{cleanText(brief.executiveSummary)}</p>
          </div>
        )}

        {/* Highlights */}
        {brief.highlights && brief.highlights.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Key Highlights</h4>
            <ul className="space-y-2">
              {brief.highlights.map((highlight, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-primary font-bold shrink-0">•</span>
                  <span className="text-muted-foreground">{cleanText(highlight)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Metrics */}
        {brief.metrics && (
          <div className="border-t border-border pt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Articles Analyzed</div>
                <div className="text-2xl font-semibold text-foreground tabular-nums mt-1">
                  {brief.metrics.articleCount}
                </div>
              </div>
              {brief.metrics.mainTopics && brief.metrics.mainTopics.length > 0 && (
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground mb-2">Main Topics</div>
                  <div className="flex flex-wrap gap-2">
                    {brief.metrics.mainTopics.map((topic) => (
                      <Badge key={topic} variant="secondary">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
