import TodayBriefCard from '../components/TodayBriefCard'
import TopicWatchlistCard from '../components/TopicWatchlistCard'
import SourceHealthCard from '../components/SourceHealthCard'
import AlertsCard from '../components/AlertsCard'
import SystemActivityCard from '../components/SystemActivityCard'
import AuthorsCard from '../components/AuthorsCard'
import FooterBranding from '../components/FooterBranding'

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-primary">Dashboard</h2>
          <p className="text-zinc-600 mt-1">Your news intelligence command center</p>
        </div>
        <button className="btn-primary">
          Run Ingestion
        </button>
      </div>

      {/* Today's Brief - Full Width */}
      <TodayBriefCard />

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <AuthorsCard />
          <TopicWatchlistCard />
          <AlertsCard />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <SourceHealthCard />
          <SystemActivityCard />
        </div>
      </div>

      {/* Footer */}
      <FooterBranding />
    </div>
  )
}
