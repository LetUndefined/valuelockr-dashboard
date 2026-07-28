import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Overview from './pages/Overview'
import PriceFlags from './pages/PriceFlags'
import PriceTrends from './pages/PriceTrends'
import ContentTools from './pages/ContentTools'
import Sync from './pages/Sync'
import IndexHealth from './pages/IndexHealth'
import ScanAnalytics from './pages/ScanAnalytics'
import SearchGaps from './pages/SearchGaps'
import Events from './pages/Events'
import Builds from './pages/Builds'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview"  element={<Overview />} />
        <Route path="flags"     element={<PriceFlags />} />
        <Route path="trends"    element={<PriceTrends />} />
        <Route path="content"   element={<ContentTools />} />
        <Route path="sync"      element={<Sync />} />
        <Route path="index"     element={<IndexHealth />} />
        <Route path="scans"     element={<ScanAnalytics />} />
        <Route path="gaps"      element={<SearchGaps />} />
        <Route path="events"    element={<Events />} />
        <Route path="builds"    element={<Builds />} />
      </Route>
    </Routes>
  )
}
