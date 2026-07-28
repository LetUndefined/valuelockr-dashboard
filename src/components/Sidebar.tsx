import { NavLink } from 'react-router-dom'

const groups = [
  {
    label: 'Overview',
    items: [{ to: '/overview', icon: '⬡', label: 'Dashboard' }],
  },
  {
    label: 'Data',
    items: [
      { to: '/flags',   icon: '⚑', label: 'Price Flags' },
      { to: '/trends',  icon: '↑', label: 'Price Trends' },
      { to: '/content', icon: '✎', label: 'Content Tools' },
    ],
  },
  {
    label: 'Sync',
    items: [
      { to: '/sync',  icon: '↻', label: 'Sync History' },
      { to: '/index', icon: '◈', label: 'Index Health' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { to: '/scans', icon: '◎', label: 'Scan Analytics' },
      { to: '/gaps',  icon: '?', label: 'Search Gaps' },
    ],
  },
  {
    label: 'App',
    items: [
      { to: '/events', icon: '◷', label: 'Events' },
      { to: '/builds', icon: '⬢', label: 'Builds' },
    ],
  },
]

export default function Sidebar() {
  return (
    <nav className="w-52 shrink-0 bg-surface border-r border-border flex flex-col overflow-y-auto">
      <div className="px-5 py-5 border-b border-border">
        <p className="text-[9px] font-bold tracking-[3px] text-amber">VALUELOCKR</p>
        <p className="text-[18px] font-bold text-white mt-0.5 tracking-tight">Admin</p>
      </div>

      <div className="flex-1 py-2">
        {groups.map((g) => (
          <div key={g.label} className="mt-4 first:mt-2">
            <p className="px-5 mb-1 text-[9px] font-semibold tracking-[1.5px] uppercase text-muted">{g.label}</p>
            {g.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-5 py-2.5 text-[13px] border-l-2 transition-colors ${
                    isActive
                      ? 'border-green text-green bg-green/8'
                      : 'border-transparent text-sub hover:bg-white/4 hover:text-white'
                  }`
                }
              >
                <span className="w-4 text-center text-sm leading-none">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      <div className="px-5 py-4 border-t border-border">
        <p className="text-[10px] text-muted">valuelockr-admin</p>
        <p className="text-[10px] text-muted/60">v0.1.0</p>
      </div>
    </nav>
  )
}
