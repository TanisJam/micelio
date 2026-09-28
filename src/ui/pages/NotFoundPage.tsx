import { useLocation } from 'wouter'
import { StateScreen } from '../components/StateScreen'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

/** The router's catch-all 404 -- an unknown path, not a GitHub-repo-not-found (see `ViewerPage`'s `not_found` state for that). */
export function NotFoundPage() {
  useDocumentTitle('Not found — Huerto')
  const [, navigate] = useLocation()

  return (
    <StateScreen eyebrow="404" title="Nothing grows here" action={{ label: 'Back to Huerto', onClick: () => navigate('/') }}>
      That page doesn&apos;t exist. Try entering a repository from the home page instead.
    </StateScreen>
  )
}
