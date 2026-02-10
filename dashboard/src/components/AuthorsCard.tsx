import { useEffect, useState } from 'react'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { Link } from 'react-router-dom'
import { Author } from '../types/author'
import { formatTimeAgo } from '../utils/time'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton, SkeletonList } from '@/components/ui/skeleton'
import { EmptyState, UserGroupIcon } from '@/components/EmptyState'

export default function AuthorsCard() {
  const [authors, setAuthors] = useState<Author[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAuthors = async () => {
      try {
        const authorsRef = collection(db, 'authors')
        const q = query(
          authorsRef,
          orderBy('lastPublished', 'desc'),
          limit(5)
        )
        const snapshot = await getDocs(q)

        const fetchedAuthors: Author[] = []
        snapshot.forEach((doc) => {
          fetchedAuthors.push({
            id: doc.id,
            ...doc.data()
          } as Author)
        })

        setAuthors(fetchedAuthors)
      } catch (err) {
        console.error('Error fetching authors:', err)
        setError(err instanceof Error ? err.message : 'Failed to load authors')
      } finally {
        setLoading(false)
      }
    }

    fetchAuthors()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Recent Authors</CardTitle>
            <Skeleton className="h-4 w-14" />
          </div>
        </CardHeader>
        <CardContent>
          <SkeletonList count={5} />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Recent Authors</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Error loading authors: {error}</p>
        </CardContent>
      </Card>
    )
  }

  if (authors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Recent Authors</CardTitle>
            <Link to="/authors" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<UserGroupIcon />}
            title="No authors yet"
            description="Authors are discovered when articles are fetched from RSS feeds."
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-testid="authors-card">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Recent Authors</CardTitle>
          <Link to="/authors" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {authors.map((author) => (
            <div
              key={author.id}
              className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {author.avatarUrl ? (
                  <img
                    src={author.avatarUrl}
                    alt={author.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-muted-foreground font-semibold text-sm">
                    {author.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <a
                    href={author.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground hover:text-primary truncate transition-colors"
                  >
                    {author.name}
                  </a>
                  {author.status === 'error' && (
                    <span
                      className="w-4 h-4 rounded-full bg-destructive/10 text-destructive text-xs flex items-center justify-center"
                      title="Feed error"
                    >
                      !
                    </span>
                  )}
                </div>

                {author.bio && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {author.bio}
                  </p>
                )}

                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{formatTimeAgo(author.lastPublished)}</span>
                  <span className="tabular-nums">{author.articleCount} articles</span>
                  {author.categories.length > 0 && (
                    <span className="truncate">
                      {author.categories.slice(0, 2).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
