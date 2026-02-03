import { Timestamp } from 'firebase/firestore'

/**
 * Format a Firestore Timestamp as a human-readable "time ago" string.
 */
export function formatTimeAgo(timestamp: Timestamp | null): string {
  if (!timestamp) return 'Unknown'

  const now = new Date()
  const date = timestamp.toDate()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}
