import { useEffect, useState } from 'react'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton'
import { EmptyState, DocumentIcon } from '@/components/EmptyState'
import { cleanText } from '../utils/text'

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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: 'easeOut' as const },
  },
}

function BriefsSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export default function DailyBriefs() {
  const [briefs, setBriefs] = useState<Brief[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchBriefs = async () => {
      try {
        const briefsRef = collection(db, 'briefs')
        const q = query(briefsRef, orderBy('date', 'desc'), limit(10))
        const snapshot = await getDocs(q)

        const fetchedBriefs: Brief[] = []
        snapshot.forEach((doc) => {
          fetchedBriefs.push({
            id: doc.id,
            ...doc.data()
          } as Brief)
        })

        setBriefs(fetchedBriefs)
      } catch (err) {
        console.error('Error fetching briefs:', err)
        setError(err instanceof Error ? err.message : 'Failed to load briefs')
      } finally {
        setLoading(false)
      }
    }

    fetchBriefs()
  }, [])

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
          Daily Intelligence Briefs
        </h1>
        <p className="text-muted-foreground mt-1">
          Executive summaries with strategic insights
        </p>
      </motion.div>

      {/* Loading */}
      {loading && <BriefsSkeleton />}

      {/* Error */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-destructive">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && briefs.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<DocumentIcon />}
              title="No briefs generated yet"
              description="Daily summaries will appear here after analysis runs. Run an ingestion to generate your first brief."
            />
          </CardContent>
        </Card>
      )}

      {/* Briefs List */}
      {!loading && !error && briefs.length > 0 && (
        <motion.div variants={containerVariants} className="space-y-6">
          {briefs.map((brief) => (
            <motion.div key={brief.id} variants={itemVariants}>
              <Card hover>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                    <div>
                      <CardTitle className="text-xl">
                        {new Date(brief.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </CardTitle>
                      {brief.headline && (
                        <p className="text-muted-foreground mt-2">
                          {cleanText(brief.headline)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {brief.meta && (
                        <>
                          <Badge variant="secondary" className="tabular-nums">
                            {brief.meta.article_count} articles
                          </Badge>
                          <Badge variant="outline" className="tabular-nums">
                            {brief.meta.section_count} sections
                          </Badge>
                        </>
                      )}
                      {brief.metrics && (
                        <Badge variant="secondary" className="tabular-nums">
                          {brief.metrics.articleCount} articles
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* New format: sections */}
                  {brief.sections && brief.sections.length > 0 && (
                    <div className="space-y-4">
                      {brief.sections.map((section, idx) => (
                        <div key={idx} className="space-y-2">
                          <Badge variant="secondary" className="font-medium">
                            {section.section_name}
                          </Badge>
                          <ul className="space-y-1.5 ml-1">
                            {section.key_points.slice(0, 3).map((point, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <span className="text-primary font-bold shrink-0">•</span>
                                <span className="text-muted-foreground">{cleanText(point)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Old format: executive summary */}
                  {brief.executiveSummary && (
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-2">Executive Summary</h4>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {cleanText(brief.executiveSummary)}
                      </p>
                    </div>
                  )}

                  {/* Old format: highlights */}
                  {brief.highlights && brief.highlights.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-3">Strategic Highlights</h4>
                      <ul className="space-y-2">
                        {brief.highlights.map((highlight, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <span className="text-primary font-bold shrink-0">•</span>
                            <span className="text-muted-foreground">{cleanText(highlight)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Main Topics */}
                  {brief.metrics?.mainTopics && brief.metrics.mainTopics.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-2">Main Topics</h4>
                      <div className="flex flex-wrap gap-2">
                        {brief.metrics.mainTopics.map((topic) => (
                          <Badge key={topic} variant="outline">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Sources */}
                  {brief.metrics?.topSources && Object.keys(brief.metrics.topSources).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-3">Top Sources</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {Object.entries(brief.metrics.topSources)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 6)
                          .map(([source, count]) => (
                            <div key={source} className="bg-muted/50 px-3 py-2 rounded-lg">
                              <div className="text-sm text-muted-foreground truncate">{source}</div>
                              <div className="text-lg font-semibold text-foreground tabular-nums">{count}</div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}
