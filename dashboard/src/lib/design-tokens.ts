/**
 * Design System Tokens
 * Central source of truth for design decisions
 */

// Typography Scale (rem units, based on 16px root)
export const typography = {
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem',// 30px
    '4xl': '2.25rem', // 36px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
  },
  letterSpacing: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
  },
} as const

// Spacing Scale (4px grid)
export const spacing = {
  0: '0',
  0.5: '0.125rem', // 2px
  1: '0.25rem',    // 4px
  1.5: '0.375rem', // 6px
  2: '0.5rem',     // 8px
  2.5: '0.625rem', // 10px
  3: '0.75rem',    // 12px
  4: '1rem',       // 16px
  5: '1.25rem',    // 20px
  6: '1.5rem',     // 24px
  8: '2rem',       // 32px
  10: '2.5rem',    // 40px
  12: '3rem',      // 48px
  16: '4rem',      // 64px
  20: '5rem',      // 80px
  24: '6rem',      // 96px
} as const

// Shadow Scale
export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
} as const

// Animation Durations (faster = more premium feel)
export const animation = {
  duration: {
    instant: '0ms',
    fast: '100ms',
    normal: '150ms',
    slow: '200ms',
    slower: '300ms',
  },
  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const

// Border Radius Scale
export const borderRadius = {
  none: '0',
  sm: '0.125rem',  // 2px
  base: '0.25rem', // 4px
  md: '0.375rem',  // 6px
  lg: '0.5rem',    // 8px
  xl: '0.75rem',   // 12px
  '2xl': '1rem',   // 16px
  full: '9999px',
} as const

// Z-Index Scale
export const zIndex = {
  hide: -1,
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  toast: 80,
} as const

// Breakpoints
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const

// Semantic Color Tokens (for use in components)
export const semanticColors = {
  // Status colors
  success: {
    light: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  warning: {
    light: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
  },
  error: {
    light: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
  },
  info: {
    light: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
  },
} as const

// Relevance Score Variants (semantic keys for CVA/cva usage)
export type RelevanceVariant = 'high' | 'medium' | 'low'

export function getRelevanceVariant(score: number): RelevanceVariant {
  if (score >= 8) return 'high'
  if (score >= 5) return 'medium'
  return 'low'
}

// Relevance Score Colors (specific to Perception)
// Note: For new components, prefer using getRelevanceVariant() with CVA
export const relevanceColors = {
  high: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',    // 8-10
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',              // 5-7
  low: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',                    // 1-4
} as const

export function getRelevanceColor(score: number): string {
  return relevanceColors[getRelevanceVariant(score)]
}

// Category Variants (semantic keys for CVA/cva usage)
export type CategoryVariant =
  | 'tech' | 'hn-popular' | 'saas_dev' | 'engineering' | 'infrastructure'
  | 'science' | 'crypto' | 'sports' | 'automotive' | 'world' | 'default'

export function getCategoryVariant(category: string): CategoryVariant {
  const normalized = category.toLowerCase()
  const knownCategories: CategoryVariant[] = [
    'tech', 'hn-popular', 'saas_dev', 'engineering', 'infrastructure',
    'science', 'crypto', 'sports', 'automotive', 'world'
  ]
  return knownCategories.includes(normalized as CategoryVariant)
    ? (normalized as CategoryVariant)
    : 'default'
}

// Category Colors
// Note: For new components, prefer using getCategoryVariant() with CVA
export const categoryColors: Record<string, string> = {
  tech: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'hn-popular': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  saas_dev: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  engineering: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  infrastructure: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
  science: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  crypto: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  sports: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  automotive: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  world: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  default: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
} as const

export function getCategoryColor(category: string): string {
  return categoryColors[getCategoryVariant(category)]
}
