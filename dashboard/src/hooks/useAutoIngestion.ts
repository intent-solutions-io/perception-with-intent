import { useEffect } from 'react'
import { toast } from 'sonner'

const MCP_URL = 'https://perception-mcp-w53xszfqnq-uc.a.run.app'
const SESSION_KEY = 'perception-auto-ingestion-fired'

export default function useAutoIngestion() {
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return

    sessionStorage.setItem(SESSION_KEY, '1')

    fetch(`${MCP_URL}/trigger/ingestion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trigger: 'auto',
        time_window_hours: 24,
        max_items_per_source: 50,
      }),
    })
      .then(async (res) => {
        if (res.status === 202) {
          const data = await res.json()
          toast.info('Refreshing your feed...', {
            description: `Run ID: ${data.run_id}`,
          })
          window.dispatchEvent(
            new CustomEvent('auto-ingestion-started', {
              detail: { run_id: data.run_id },
            })
          )
        }
        // 409 = already running, silently ignore
      })
      .catch(() => {
        // Fire-and-forget — don't block dashboard load
      })
  }, [])
}
