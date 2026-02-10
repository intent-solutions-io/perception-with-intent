import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import TodayBriefCard from '../components/TodayBriefCard'
import TopicWatchlistCard from '../components/TopicWatchlistCard'
import SourceHealthCard from '../components/SourceHealthCard'
import AlertsCard from '../components/AlertsCard'
import SystemActivityCard from '../components/SystemActivityCard'
import AuthorsCard from '../components/AuthorsCard'
import FooterBranding from '../components/FooterBranding'

const MCP_URL = 'https://perception-mcp-w53xszfqnq-uc.a.run.app'

// Stagger animation variants for cards
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: 'easeOut' as const,
    },
  },
}

export default function Dashboard() {
  const [ingesting, setIngesting] = useState(false)

  const handleRunIngestion = async () => {
    setIngesting(true)

    try {
      const response = await fetch(`${MCP_URL}/mcp/tools/fetch_rss_feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feed_id: 'hackernews' })
      })

      if (response.ok) {
        const data = await response.json()
        const articleCount = data.articles?.length || 0
        toast.success(`Fetched ${articleCount} articles from HackerNews`, {
          description: 'Ingestion completed successfully',
        })
      } else {
        toast.warning('Ingestion service unavailable', {
          description: 'The MCP service may be restarting. Try again in a moment.',
        })
      }
    } catch {
      toast.error('Failed to connect to ingestion service', {
        description: 'Check your network connection and try again.',
      })
    } finally {
      setIngesting(false)
    }
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Your news intelligence command center
          </p>
        </div>
        <Button
          onClick={handleRunIngestion}
          disabled={ingesting}
          className="w-full sm:w-auto"
        >
          {ingesting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Running...
            </>
          ) : (
            'Run Ingestion'
          )}
        </Button>
      </motion.div>

      {/* Today's Brief - Full Width */}
      <motion.div variants={itemVariants}>
        <TodayBriefCard />
      </motion.div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <motion.div variants={containerVariants} className="space-y-6">
          <motion.div variants={itemVariants}>
            <AuthorsCard />
          </motion.div>
          <motion.div variants={itemVariants}>
            <TopicWatchlistCard />
          </motion.div>
          <motion.div variants={itemVariants}>
            <AlertsCard />
          </motion.div>
        </motion.div>

        {/* Right Column */}
        <motion.div variants={containerVariants} className="space-y-6">
          <motion.div variants={itemVariants}>
            <SourceHealthCard />
          </motion.div>
          <motion.div variants={itemVariants}>
            <SystemActivityCard />
          </motion.div>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div variants={itemVariants}>
        <FooterBranding />
      </motion.div>
    </motion.div>
  )
}
