import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  startAfter,
  where,
  QueryDocumentSnapshot,
  DocumentData,
  QueryConstraint
} from 'firebase/firestore'
import { db } from '../firebase'
import { Author } from '../types/author'
import AuthorRow from '../components/AuthorRow'
import FooterBranding from '../components/FooterBranding'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SkeletonList } from '@/components/ui/skeleton'
import { EmptyState, UserGroupIcon } from '@/components/EmptyState'

const PAGE_SIZE = 20
const FILTERED_PAGE_SIZE = 100

type StatusFilter = 'all' | 'active' | 'inactive' | 'error'
type RecencyFilter = 'all' | '7d' | '30d' | '90d'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.15, ease: 'easeOut' as const },
  },
}

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

  const prevStatusFilter = useRef(statusFilter)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const availableCategories = useMemo(() => {
    const categories = new Set<string>()
    authors.forEach((author) => {
      author.categories.forEach((cat) => categories.add(cat))
    })
    return Array.from(categories).sort()
  }, [authors])

  const hasClientSideFilters = debouncedSearch || categoryFilter !== 'all' || recencyFilter !== 'all'

  const buildQuery = useCallback((startAfterDoc?: QueryDocumentSnapshot<DocumentData>) => {
    const authorsRef = collection(db, 'authors')
    const constraints: QueryConstraint[] = [
      orderBy('lastPublished', 'desc')
    ]

    if (statusFilter !== 'all') {
      constraints.push(where('status', '==', statusFilter))
    }

    const pageSize = hasClientSideFilters ? FILTERED_PAGE_SIZE : PAGE_SIZE
    constraints.push(limit(pageSize))

    if (startAfterDoc) {
      constraints.push(startAfter(startAfterDoc))
    }

    return query(authorsRef, ...constraints)
  }, [statusFilter, hasClientSideFilters])

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

  useEffect(() => {
    fetchAuthors()
  }, [statusFilter])

  useEffect(() => {
    if (prevStatusFilter.current !== statusFilter) {
      setAuthors([])
      setLastDoc(null)
      setHasMore(true)
      prevStatusFilter.current = statusFilter
    }
  }, [statusFilter])

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

  const filteredAuthors = useMemo(() => {
    return authors.filter((author) => {
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

      if (categoryFilter !== 'all' && !author.categories.includes(categoryFilter)) {
        return false
      }

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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            Authors
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse content creators sorted by recent activity
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            <SkeletonList count={10} />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            Authors
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse content creators sorted by recent activity
          </p>
        </div>
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-6">
            <p className="text-destructive font-medium">Error loading authors</p>
            <p className="text-destructive/80 text-sm mt-1">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            Authors
          </h1>
          <p className="text-muted-foreground mt-1 tabular-nums">
            {filteredAuthors.length} of {authors.length} authors
            {hasActiveFilters && ' (filtered)'}
          </p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Search by name, category, or bio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Status Filter */}
              <div className="w-full lg:w-40">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
              <div className="mt-3 pt-3 border-t border-border">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear all filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Authors List */}
      {filteredAuthors.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-6">
              <EmptyState
                icon={<UserGroupIcon />}
                title={hasActiveFilters ? 'No authors match your filters' : 'No authors yet'}
                description={
                  hasActiveFilters
                    ? 'Try adjusting your search or filter criteria'
                    : 'Authors are discovered when articles are fetched during ingestion'
                }
                action={hasActiveFilters ? { label: 'Clear filters', onClick: clearFilters } : undefined}
              />
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} className="space-y-3">
          {filteredAuthors.map((author, idx) => (
            <motion.div
              key={author.id}
              variants={itemVariants}
              custom={idx}
            >
              <AuthorRow author={author} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 text-muted-foreground">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading more...
          </div>
        </div>
      )}

      {/* End of list */}
      {!hasMore && authors.length > 0 && !hasActiveFilters && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          End of list
        </div>
      )}

      {/* Footer */}
      <FooterBranding />
    </motion.div>
  )
}
