/**
 * Author interface for Firestore /authors collection
 *
 * Represents a content author/feed source with AI-generated bio
 * and freshness tracking for the author-focused dashboard.
 */

import { Timestamp } from 'firebase/firestore'

export interface Author {
  id: string                      // Slugified author name
  name: string                    // Display name
  feedUrl: string                 // RSS/Atom feed URL
  websiteUrl: string              // Blog homepage
  avatarUrl?: string              // Optional avatar
  bio?: string                    // AI-generated (Gemini)
  bioGeneratedAt?: Timestamp      // When bio was last updated
  categories: string[]            // Topics they write about

  // Freshness tracking
  lastPublished: Timestamp        // Their most recent article date
  lastFetched: Timestamp          // When we last checked their feed
  articleCount: number            // Total articles from this author

  // Metadata
  source: string                  // Where we discovered them (hn-gist, awesome-rss, etc.)
  status: 'active' | 'inactive' | 'error'
  consecutiveErrors?: number      // Error count for health monitoring
  createdAt: Timestamp
  updatedAt: Timestamp
}

/**
 * Author with serialized timestamps for API responses
 */
export interface AuthorSerialized {
  id: string
  name: string
  feedUrl: string
  websiteUrl: string
  avatarUrl?: string
  bio?: string
  bioGeneratedAt?: string
  categories: string[]

  lastPublished: string
  lastFetched: string
  articleCount: number

  source: string
  status: 'active' | 'inactive' | 'error'
  consecutiveErrors?: number
  createdAt: string
  updatedAt: string
}

/**
 * Minimal author data for list displays
 */
export interface AuthorSummary {
  id: string
  name: string
  avatarUrl?: string
  bio?: string
  lastPublished: Timestamp | string
  articleCount: number
  categories: string[]
  status: 'active' | 'inactive' | 'error'
}
