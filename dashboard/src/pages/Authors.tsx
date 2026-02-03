import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  startAfter,
  where,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
  QueryConstraint
} from 'firebase/firestore'
import { db } from '../firebase'
import { Author } from '../types/author'
import AuthorRow from '../components/AuthorRow'
import FooterBranding from '../components/FooterBranding'

const PAGE_SIZE = 20
const FILTERED_PAGE_SIZE = 100 // Load more when client-side filters active

type StatusFilter = 'all' | 'active' | 'inactive' | 'error'
type RecencyFilter = 'all' | '7d' | '30d' | '90d'

export default function Authors() {
  const [authors, setAuthors] = useState<Author[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [recencyFilter, setRecencyFilter] = useState<RecencyFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // Track if we need to refetch due to filter changes
  const prevStatusFilter = useRef(statusFilter)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Extract unique categories from all authors
  const availableCategories = useMemo(() => {
    const categories = new Set<string>()
    authors.forEach((author) => {
      author.categories.forEach((cat) => categories.add(cat))
    })
    return Array.from(categories).sort()
  }, [authors])

  // Check if client-side filters are active (these don't work well with pagination)
  const hasClientSideFilters = debouncedSearch || categoryFilter !== 'all' || recencyFilter !== 'all'

  // Build Firestore query with server-side filters
  const buildQuery = useCallback((startAfterDoc?: QueryDocumentSnapshot<DocumentData>) => {
    const authorsRef = collection(db, 'authors')
    const constraints: QueryConstraint[] = [
      orderBy('lastPublished', 'desc')
    ]

    // Server-side filter: status
    if (statusFilter !== 'all') {
      constraints.push(where('status', '==', statusFilter))
    }

    // Use larger page size when client-side filters are active
    const pageSize = hasClientSideFilters ? FILTERED_PAGE_SIZE : PAGE_SIZE
    constraints.push(limit(pageSize))

    if (startAfterDoc) {
      constraints.push(startAfter(startAfterDoc))
    }

    return query(authorsRef, ...constraints)
  }, [statusFilter, hasClientSideFilters])

  // Fetch authors (initial or after filter change)
  const fetchAuthors = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const q = buildQuery()
      const snapshot = await getDocs(q)

      const fetchedAuthors: Author[] = []
      snapshot.forEach((doc) => {
        fetchedAuthors.push({
          id: doc.id,
          ...doc.data()
        } as Author)
      })

      setAuthors(fetchedAuthors)
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null)
      const pageSize = hasClientSideFilters ? FILTERED_PAGE_SIZE : PAGE_SIZE
      setHasMore(snapshot.docs.length === pageSize)
    } catch (err) {
      console.error('Error fetching authors:', err)
      setError(err instanceof Error ? err.message : 'Failed to load authors')
    } finally {
      setLoading(false)
    }
  }, [buildQuery, hasClientSideFilters])

  // Initial fetch and refetch when server-side filters change
  useEffect(() => {
    fetchAuthors()
  }, [statusFilter]) // Only refetch for server-side filter changes

  // Reset when status filter changes
  useEffect(() => {
    if (prevStatusFilter.current !== statusFilter) {
      setAuthors([])
      setLastDoc(null)
      setHasMore(true)
      prevStatusFilter.current = statusFilter
    }
  }, [statusFilter])

  // Load more
  const loadMore = useCallback(async () => {
    if (!lastDoc || loadingMore || !hasMore) return

    setLoadingMore(true)
    try {
      const q = buildQuery(lastDoc)
      const snapshot = await getDocs(q)

      const newAuthors: Author[] = []
      snapshot.forEach((doc) => {
        newAuthors.push({
          id: doc.id,
          ...doc.data()
        } as Author)
      })

      setAuthors((prev) => [...prev, ...newAuthors])
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null)
      const pageSize = hasClientSideFilters ? FILTERED_PAGE_SIZE : PAGE_SIZE
      setHasMore(snapshot.docs.length === pageSize)
    } catch (err) {
      console.error('Error loading more authors:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [lastDoc, loadingMore, hasMore, buildQuery, hasClientSideFilters])

  // Infinite scroll handler
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 500
      ) {
        loadMore()
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [loadMore])

  // Apply client-side filters
  const filteredAuthors = useMemo(() => {
    return authors.filter((author) => {
      // Search filter (client-side)
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase()
        const matchesName = author.name.toLowerCase().includes(searchLower)
        const matchesCategory = author.categories.some((cat) =>
          cat.toLowerCase().includes(searchLower)
        )
        const matchesBio = author.bio?.toLowerCase().includes(searchLower)
        if (!matchesName && !matchesCategory && !matchesBio) {
          return false
        }
      }

      // Category filter (client-side)
      if (categoryFilter !== 'all' && !author.categories.includes(categoryFilter)) {
        return false
      }

      // Recency filter (client-side)
      if (recencyFilter !== 'all') {
        const now = new Date()
        const lastPublished = author.lastPublished?.toDate() || new Date(0)
        const diffDays = Math.floor((now.getTime() - lastPublished.getTime()) / (1000 * 60 * 60 * 24))

        switch (recencyFilter) {
          case '7d':
            if (diffDays > 7) return false
            break
          case '30d':
            if (diffDays > 30) return false
            break
          case '90d':
            if (diffDays > 90) return false
            break
        }
      }

      return true
    })
  }, [authors, debouncedSearch, categoryFilter, recencyFilter])

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setRecencyFilter('all')
    setCategoryFilter('all')
  }

  const hasActiveFilters = debouncedSearch || statusFilter !== 'all' || recencyFilter !== 'all' || categoryFilter !== 'all'

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-primary">Authors</h2>
            <p className="text-zinc-600 mt-1">Browse content creators sorted by recent activity</p>
          </div>
        </div>

        <div className="flex items-center justify-center py-12">
          <div className="text-zinc-500">Loading authors...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-primary">Authors</h2>
            <p className="text-zinc-600 mt-1">Browse content creators sorted by recent activity</p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="text-red-700 font-medium">Error loading authors</div>
          <div className="text-red-600 text-sm mt-1">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h2 className="text-3xl font-bold text-primary">Authors</h2>
          <p className="text-zinc-600 mt-1">
            {filteredAuthors.length} of {authors.length} authors
            {hasActiveFilters && ' (filtered)'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-zinc-200 rounded-lg p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, category, or bio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Status Filter */}
          <div className="w-full lg:w-40">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full px-4 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="error">Error</option>
            </select>
          </div>

          {/* Recency Filter */}
          <div className="w-full lg:w-40">
            <select
              value={recencyFilter}
              onChange={(e) => setRecencyFilter(e.target.value as RecencyFilter)}
              className="w-full px-4 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="all">Any Time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="w-full lg:w-48">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="all">All Categories</option>
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <div className="mt-3 pt-3 border-t border-zinc-100">
            <button
              onClick={clearFilters}
              className="text-sm text-primary hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Authors List */}
      {filteredAuthors.length === 0 ? (
        <div className="text-center py-12">
          {hasActiveFilters ? (
            <>
              <div className="text-zinc-400 text-lg">No authors match your filters</div>
              <button
                onClick={clearFilters}
                className="text-primary hover:underline mt-2"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <div className="text-zinc-400 text-lg">No authors yet</div>
              <p className="text-zinc-500 text-sm mt-2">
                Authors are discovered when articles are fetched during ingestion
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAuthors.map((author) => (
            <AuthorRow key={author.id} author={author} />
          ))}
        </div>
      )}

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="text-center py-4">
          <div className="text-zinc-500">Loading more...</div>
        </div>
      )}

      {/* End of list */}
      {!hasMore && authors.length > 0 && !hasActiveFilters && (
        <div className="text-center py-4 text-zinc-400 text-sm">
          End of list
        </div>
      )}

      {/* Footer */}
      <FooterBranding />
    </div>
  )
}
