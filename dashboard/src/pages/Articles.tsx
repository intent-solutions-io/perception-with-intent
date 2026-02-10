import { useEffect, useState } from 'react'
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore'
import { db } from '../firebase'
import { cleanSummary, extractHNLink } from '../utils/text'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton, SkeletonArticle } from '@/components/ui/skeleton'
import { EmptyState, NewspaperIcon } from '@/components/EmptyState'
import { getRelevanceColor, getCategoryColor } from '@/lib/design-tokens'

interface Article {
  id: string
  title: string
  summary?: string
  url: string
  source_id: string
  source_name?: string
  category: string
  published_at: string
  relevance_score: number
  hn_points?: number
  trending_score?: number
}

interface HNStory {
  id: number
  title: string
  url?: string
  score: number
  descendants: number
}

function calculateTrendingScore(article: Article): number {
  const now = new Date()
  const published = new Date(article.published_at)
  const hoursAgo = (now.getTime() - published.getTime()) / (1000 * 60 * 60)
  const recencyBoost = Math.max(0, 5 - (hoursAgo / 5))
  const baseScore = article.relevance_score || 0
  const hnBoost = article.hn_points ? Math.min(5, article.hn_points / 100) : 0
  return baseScore + recencyBoost + hnBoost
}

async function fetchHNTopStories(): Promise<Map<string, HNStory>> {
  const urlToStory = new Map<string, HNStory>()
  try {
    const idsResponse = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
    const ids: number[] = await idsResponse.json()
    const storyPromises = ids.slice(0, 30).map(async (id) => {
      const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
      return res.json() as Promise<HNStory>
    })
    const stories = await Promise.all(storyPromises)
    stories.forEach(story => {
      if (story && story.url) {
        urlToStory.set(story.url, story)
      }
    })
  } catch (err) {
    console.error('Failed to fetch HN stories:', err)
  }
  return urlToStory
}

const CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'tech', name: 'Tech' },
  { id: 'hn-popular', name: 'HN Blogs' },
  { id: 'saas_dev', name: 'SaaS/Dev' },
  { id: 'engineering', name: 'Engineering' },
  { id: 'infrastructure', name: 'Infrastructure' },
  { id: 'science', name: 'Science' },
  { id: 'crypto', name: 'Crypto' },
  { id: 'sports', name: 'Sports' },
  { id: 'automotive', name: 'Auto' },
  { id: 'world', name: 'World' },
]

// Trending section component
function TrendingSection({
  articles,
  onArticleClick
}: {
  articles: Article[]
  onArticleClick: (url: string) => void
}) {
  const trendingByCategory = articles.reduce((acc, article) => {
    const cat = article.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(article)
    return acc
  }, {} as Record<string, Article[]>)

  Object.keys(trendingByCategory).forEach(cat => {
    trendingByCategory[cat] = trendingByCategory[cat]
      .sort((a, b) => (b.trending_score || 0) - (a.trending_score || 0))
      .slice(0, 3)
  })

  const sortedCategories = Object.entries(trendingByCategory)
    .filter(([_, articles]) => articles.length > 0)
    .sort((a, b) => {
      const maxA = Math.max(...a[1].map(x => x.trending_score || 0))
      const maxB = Math.max(...b[1].map(x => x.trending_score || 0))
      return maxB - maxA
    })
    .slice(0, 4)

  const categoryNames: Record<string, string> = {
    'tech': 'Tech',
    'hn-popular': 'HN Blogs',
    'saas_dev': 'SaaS/Dev',
    'engineering': 'Engineering',
    'infrastructure': 'Infra',
    'science': 'Science',
    'crypto': 'Crypto',
    'sports': 'Sports',
    'automotive': 'Auto',
    'world': 'World',
  }

  if (sortedCategories.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🔥</span>
        <h2 className="text-lg font-semibold text-foreground">Trending Now</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {sortedCategories.map(([category, categoryArticles], idx) => (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Card className="h-full border-l-4 border-l-primary/50">
              <CardContent className="p-4">
                <h3 className="font-medium text-muted-foreground text-sm mb-3">
                  {categoryNames[category] || category}
                </h3>
                <div className="space-y-3">
                  {categoryArticles.map((article, articleIdx) => (
                    <a
                      key={article.id}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.preventDefault()
                        onArticleClick(article.url)
                        window.open(article.url, '_blank')
                      }}
                      className="block group"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground text-sm font-medium w-4 tabular-nums">
                          {articleIdx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground group-hover:text-primary line-clamp-2 leading-snug transition-colors">
                            {article.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {article.hn_points && (
                              <span className="text-xs text-orange-500 dark:text-orange-400 font-medium tabular-nums">
                                ▲ {article.hn_points}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {Math.round(article.trending_score || 0)} pts
                            </span>
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function ArticleCard({ article, expanded, onToggle }: {
  article: Article
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <motion.div
      layout
      className="border-b border-border py-4 last:border-0"
    >
      <div className="flex items-start gap-3">
        {/* Score indicator */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0 ${getRelevanceColor(article.relevance_score)}`}>
          {article.relevance_score}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title - clickable to expand */}
          <button
            onClick={onToggle}
            className="text-left w-full group"
          >
            <h3 className="font-medium text-foreground group-hover:text-primary transition-colors leading-snug">
              {article.title}
            </h3>
          </button>

          {/* Source */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-sm font-medium text-foreground">
              {article.source_name || article.source_id}
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-sm text-muted-foreground">{formatTimeAgo(article.published_at)}</span>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="secondary" className={getCategoryColor(article.category)}>
              {CATEGORIES.find(c => c.id === article.category)?.name || article.category}
            </Badge>
            {article.hn_points && (
              <Badge variant="outline" className="text-orange-500 dark:text-orange-400 border-orange-200 dark:border-orange-800">
                ▲ {article.hn_points} on HN
              </Badge>
            )}
          </div>

          {/* Expanded content */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-3">
                  {article.summary && cleanSummary(article.summary) && (
                    <p className="text-muted-foreground text-sm leading-relaxed bg-muted/50 p-3 rounded-lg">
                      {cleanSummary(article.summary)}
                    </p>
                  )}
                  <div className="flex items-center gap-4">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      Read full article
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    {extractHNLink(article.summary || '') && (
                      <a
                        href={extractHNLink(article.summary || '')!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 font-medium transition-colors"
                      >
                        HN Discussion
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Expand indicator */}
        <button
          onClick={onToggle}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors shrink-0"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <motion.svg
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.15 }}
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </button>
      </div>
    </motion.div>
  )
}

function ArticlesSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <SkeletonArticle key={i} />
      ))}
    </div>
  )
}

export default function Articles() {
  const [articles, setArticles] = useState<Article[]>([])
  const [allArticles, setAllArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hnStories, setHnStories] = useState<Map<string, HNStory>>(new Map())

  useEffect(() => {
    fetchHNTopStories().then(setHnStories)
  }, [])

  useEffect(() => {
    const fetchAllArticles = async () => {
      try {
        const articlesRef = collection(db, 'articles')
        const q = query(
          articlesRef,
          orderBy('relevance_score', 'desc'),
          orderBy('published_at', 'desc'),
          limit(200)
        )
        const snapshot = await getDocs(q)
        const fetched: Article[] = []
        snapshot.forEach((doc) => {
          fetched.push({ id: doc.id, ...doc.data() } as Article)
        })
        setAllArticles(fetched)
      } catch (err) {
        console.error('Error fetching all articles:', err)
      }
    }
    fetchAllArticles()
  }, [])

  const articlesWithTrending = allArticles.map(article => {
    const hnStory = hnStories.get(article.url)
    const articleWithHN = {
      ...article,
      hn_points: hnStory?.score,
    }
    return {
      ...articleWithHN,
      trending_score: calculateTrendingScore(articleWithHN)
    }
  })

  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true)
      setError(null)

      try {
        const articlesRef = collection(db, 'articles')
        let q

        if (selectedCategory === 'all') {
          q = query(
            articlesRef,
            orderBy('relevance_score', 'desc'),
            orderBy('published_at', 'desc'),
            limit(100)
          )
        } else {
          q = query(
            articlesRef,
            where('category', '==', selectedCategory),
            orderBy('published_at', 'desc'),
            limit(100)
          )
        }

        const snapshot = await getDocs(q)
        const fetchedArticles: Article[] = []

        snapshot.forEach((doc) => {
          const data = doc.data()
          const article = { id: doc.id, ...data } as Article
          const hnStory = hnStories.get(article.url)
          if (hnStory) {
            article.hn_points = hnStory.score
          }
          article.trending_score = calculateTrendingScore(article)
          fetchedArticles.push(article)
        })

        setArticles(fetchedArticles)
      } catch (err) {
        console.error('Error fetching articles:', err)
        setError(err instanceof Error ? err.message : 'Failed to load articles')
      } finally {
        setLoading(false)
      }
    }

    fetchArticles()
  }, [selectedCategory, hnStories])

  const groupedArticles = articles.reduce((acc, article) => {
    const cat = article.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(article)
    return acc
  }, {} as Record<string, Article[]>)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto px-4 py-8"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
          News Feed
        </h1>
        <p className="text-muted-foreground mt-1 tabular-nums">
          {articles.length} articles from {Object.keys(groupedArticles).length} categories
        </p>
      </motion.div>

      {/* Trending Section */}
      {!loading && articlesWithTrending.length > 0 && (
        <TrendingSection
          articles={articlesWithTrending}
          onArticleClick={(url) => console.log('Clicked:', url)}
        />
      )}

      {/* Category filters */}
      <div className="sticky top-16 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-3 z-10 border-b border-border mb-6 -mx-4 px-4">
        {/* Featured: HN Popular Blogs */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => setSelectedCategory('hn-popular')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 active:scale-[0.98] ${
              selectedCategory === 'hn-popular'
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50 border border-orange-200 dark:border-orange-800'
            }`}
          >
            <span className="text-lg">🔥</span>
            HN Popular Blogs
            <span className="text-xs opacity-75">(92 sources)</span>
          </button>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Curated tech blogs from Hacker News favorites
          </span>
        </div>

        {/* Other categories with animated underline */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.filter(cat => cat.id !== 'hn-popular').map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`relative px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-[0.98] ${
                selectedCategory === cat.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {cat.name}
              {selectedCategory === cat.id && articles.length > 0 && (
                <span className="ml-1.5 opacity-70 tabular-nums">({articles.length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading && <ArticlesSkeleton />}

      {/* Error state */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-destructive">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !error && articles.length === 0 && (
        <EmptyState
          icon={<NewspaperIcon />}
          title="No articles found"
          description={
            selectedCategory === 'all'
              ? 'Run ingestion to fetch articles from your sources'
              : `No articles in ${selectedCategory} category`
          }
        />
      )}

      {/* Articles list */}
      {!loading && !error && articles.length > 0 && (
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            <div className="p-4">
              {articles.map((article, idx) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                >
                  <ArticleCard
                    article={article}
                    expanded={expandedId === article.id}
                    onToggle={() => setExpandedId(expandedId === article.id ? null : article.id)}
                  />
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Load more hint */}
      {!loading && articles.length >= 100 && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          Showing first 100 articles
        </div>
      )}
    </motion.div>
  )
}
