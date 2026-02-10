import { useEffect, useState } from 'react'
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, HashtagIcon } from '@/components/EmptyState'

interface Topic {
  id: string
  keyword: string
  category?: string
  sources?: string[]
  priority?: number
  created_at?: string
}

interface Source {
  id: string
  name: string
  category: string
  url: string
}

const CATEGORIES = [
  'tech', 'ai', 'ai_company', 'saas_dev', 'engineering', 'infrastructure',
  'security', 'crypto', 'business', 'world', 'science', 'sports',
  'automotive', 'ev', 'trucking', 'hn-popular'
]

function TopicsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Topic Watchlist</CardTitle>
          <Skeleton className="h-8 w-24" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-3 border border-border rounded-lg">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function TopicWatchlistCard() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add topic form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [sourceSearch, setSourceSearch] = useState('')
  const [saving, setSaving] = useState(false)

  // Fetch topics and sources
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch topics
        const topicsRef = collection(db, 'topics_to_monitor')
        const topicsSnapshot = await getDocs(topicsRef)
        const topicsList = topicsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as Topic[]
        setTopics(topicsList)

        // Fetch sources
        const sourcesRef = collection(db, 'sources')
        const sourcesSnapshot = await getDocs(sourcesRef)
        const sourcesList = sourcesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as Source[]
        setSources(sourcesList)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Filter sources by search and category
  const filteredSources = sources.filter(source => {
    const matchesSearch = source.name.toLowerCase().includes(sourceSearch.toLowerCase()) ||
                         source.category.toLowerCase().includes(sourceSearch.toLowerCase())
    const matchesCategory = !selectedCategory || source.category === selectedCategory
    return matchesSearch && matchesCategory
  }).slice(0, 10)

  // Add new topic
  const handleAddTopic = async () => {
    if (!newKeyword.trim()) return

    setSaving(true)
    try {
      const topicId = newKeyword.toLowerCase().replace(/\s+/g, '-')
      const newTopic: Omit<Topic, 'id'> = {
        keyword: newKeyword.trim(),
        category: selectedCategory || undefined,
        sources: selectedSources.length > 0 ? selectedSources : undefined,
        priority: 2,
        created_at: new Date().toISOString()
      }

      await setDoc(doc(db, 'topics_to_monitor', topicId), newTopic)

      setTopics([...topics, { id: topicId, ...newTopic }])
      setNewKeyword('')
      setSelectedCategory('')
      setSelectedSources([])
      setSourceSearch('')
      setShowAddForm(false)
      toast.success(`Added "${newKeyword}" to watchlist`)
    } catch (err) {
      console.error('Error adding topic:', err)
      toast.error('Failed to add topic')
    } finally {
      setSaving(false)
    }
  }

  // Delete topic
  const handleDeleteTopic = async (topicId: string, keyword: string) => {
    try {
      await deleteDoc(doc(db, 'topics_to_monitor', topicId))
      setTopics(topics.filter(t => t.id !== topicId))
      toast.success(`Removed "${keyword}" from watchlist`)
    } catch (err) {
      console.error('Error deleting topic:', err)
      toast.error('Failed to delete topic')
    }
  }

  // Toggle source selection
  const toggleSource = (sourceId: string) => {
    if (selectedSources.includes(sourceId)) {
      setSelectedSources(selectedSources.filter(s => s !== sourceId))
    } else {
      setSelectedSources([...selectedSources, sourceId])
    }
  }

  if (loading) {
    return <TopicsSkeleton />
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Topic Watchlist</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Topic Watchlist</CardTitle>
          <Button
            variant={showAddForm ? 'outline' : 'default'}
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Cancel' : '+ Add Topic'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Add Topic Form */}
        {showAddForm && (
          <div className="mb-4 p-4 bg-muted/50 rounded-lg border border-border">
            <div className="space-y-3">
              {/* Keyword Input */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Keyword to watch
                </label>
                <Input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="e.g., AI, Kubernetes, Security"
                />
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Category (optional)
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">All categories</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Source Search */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Filter by sources (optional)
                </label>
                <Input
                  type="text"
                  value={sourceSearch}
                  onChange={(e) => setSourceSearch(e.target.value)}
                  placeholder="Search sources..."
                />

                {/* Source Results */}
                {sourceSearch && (
                  <div className="mt-2 max-h-32 overflow-y-auto border border-border rounded-lg bg-background">
                    {filteredSources.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">No sources found</div>
                    ) : (
                      filteredSources.map(source => (
                        <button
                          key={source.id}
                          onClick={() => toggleSource(source.id)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex justify-between items-center ${
                            selectedSources.includes(source.id) ? 'bg-primary/5' : ''
                          }`}
                        >
                          <span className="text-foreground">{source.name}</span>
                          <span className="text-xs text-muted-foreground">{source.category}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Selected Sources */}
                {selectedSources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedSources.map(sourceId => {
                      const source = sources.find(s => s.id === sourceId)
                      return (
                        <Badge
                          key={sourceId}
                          variant="secondary"
                          className="gap-1"
                        >
                          {source?.name || sourceId}
                          <button
                            onClick={() => toggleSource(sourceId)}
                            className="hover:text-foreground ml-1"
                          >
                            ×
                          </button>
                        </Badge>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleAddTopic}
                disabled={!newKeyword.trim() || saving}
                className="w-full"
              >
                {saving ? 'Adding...' : 'Add Topic'}
              </Button>
            </div>
          </div>
        )}

        {/* Topics List */}
        {topics.length === 0 ? (
          <EmptyState
            icon={<HashtagIcon />}
            title="No topics configured"
            description="Add keywords to start tracking specific topics across all your news sources."
            action={{
              label: 'Add Topic',
              onClick: () => setShowAddForm(true)
            }}
          />
        ) : (
          <div className="space-y-2">
            {topics.map((topic) => (
              <div
                key={topic.id}
                className="p-3 border border-border rounded-lg hover:border-border/80 hover:bg-muted/30 transition-all group"
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {topic.keyword}
                      </span>
                      {topic.category && (
                        <Badge variant="outline" className="text-xs">
                          {topic.category}
                        </Badge>
                      )}
                    </div>
                    {topic.sources && topic.sources.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {topic.sources.length} source{topic.sources.length > 1 ? 's' : ''} selected
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteTopic(topic.id, topic.keyword)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/10 transition-all"
                    title="Delete topic"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 text-xs text-muted-foreground tabular-nums">
          {sources.length} sources available • {topics.length} topics watching
        </div>
      </CardContent>
    </Card>
  )
}
