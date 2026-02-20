import { motion } from 'framer-motion'
import TodayBriefCard from '../components/TodayBriefCard'
import TopicWatchlistCard from '../components/TopicWatchlistCard'
import SourceHealthCard from '../components/SourceHealthCard'
import AlertsCard from '../components/AlertsCard'
import SystemActivityCard from '../components/SystemActivityCard'
import AuthorsCard from '../components/AuthorsCard'
import FooterBranding from '../components/FooterBranding'
import IngestionButton from '../components/IngestionButton'
import useAutoIngestion from '../hooks/useAutoIngestion'

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
  useAutoIngestion()

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
        <IngestionButton />
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
