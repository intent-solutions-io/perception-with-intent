import { useEffect, useState } from 'react'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { Link } from 'react-router-dom'
import { Author } from '../types/author'
import { formatTimeAgo } from '../utils/time'

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
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-primary">Recent Authors</h3>
          <Link to="/authors" className="text-sm text-zinc-500 hover:text-primary">
            View all
          </Link>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="text-zinc-500">Loading authors...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card border-red-200 bg-red-50">
        <h3 className="text-xl font-bold text-red-700 mb-4">Recent Authors</h3>
        <div className="text-red-600 text-sm">
          Error loading authors: {error}
        </div>
      </div>
    )
  }

  if (authors.length === 0) {
    return (
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-primary">Recent Authors</h3>
          <Link to="/authors" className="text-sm text-zinc-500 hover:text-primary">
            View all
          </Link>
        </div>
        <div className="text-center py-8">
          <div className="text-zinc-400 text-lg">No authors yet</div>
          <p className="text-zinc-500 text-sm mt-2">
            Authors are discovered when articles are fetched
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-primary">Recent Authors</h3>
        <Link to="/authors" className="text-sm text-zinc-500 hover:text-primary">
          View all
        </Link>
      </div>

      <div className="space-y-4">
        {authors.map((author) => (
          <div key={author.id} className="flex items-start gap-3 pb-4 border-b border-zinc-100 last:border-0 last:pb-0">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center flex-shrink-0">
              {author.avatarUrl ? (
                <img
                  src={author.avatarUrl}
                  alt={author.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <span className="text-zinc-500 font-semibold text-sm">
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
                  className="font-semibold text-zinc-900 hover:text-primary truncate"
                >
                  {author.name}
                </a>
                {author.status === 'error' && (
                  <span className="text-xs text-red-500" title="Feed error">
                    !
                  </span>
                )}
              </div>

              {author.bio && (
                <p className="text-sm text-zinc-600 line-clamp-2 mt-1">
                  {author.bio}
                </p>
              )}

              <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                <span>{formatTimeAgo(author.lastPublished)}</span>
                <span>{author.articleCount} articles</span>
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
    </div>
  )
}
