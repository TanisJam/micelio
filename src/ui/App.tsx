import { Route, Switch } from 'wouter'
import { LandingPage } from './pages/LandingPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ViewerPage } from './pages/ViewerPage'
import { ui } from './theme/tokens'

/**
 * The router root (T7): `/` is the landing page, `/:owner/:repo` is the
 * viewer, anything else is a friendly 404. `?sel=<id>` continues to work
 * unchanged -- `useSelection` reads/writes it directly via the History API,
 * independent of the router.
 */
export function App() {
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'auto', background: ui.bg, color: ui.text, fontFamily: ui.fontBody }}>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/:owner/:repo">{(params) => <ViewerPage owner={params.owner} repo={params.repo} />}</Route>
        <Route component={NotFoundPage} />
      </Switch>
    </div>
  )
}
