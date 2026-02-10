import { auth } from '../firebase'

export default function FooterBranding() {
  const user = auth.currentUser

  return (
    <footer className="mt-12 py-8 border-t border-border">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground">
          Perception With Intent
        </h3>
        <p className="text-muted-foreground text-sm mt-2">
          Created by{' '}
          <a
            href="https://intentsolutions.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:underline font-medium transition-colors"
          >
            intent solutions io
          </a>
        </p>
        {user && (
          <p className="text-muted-foreground/70 text-xs mt-3">
            Logged in as: {user.email}
          </p>
        )}
      </div>
    </footer>
  )
}
