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
      <div className="px-4 py-5 border-b border-border">
        <p className="text-[9px] font-bold tracking-[2px] text-gold">VALUELOCKR</p>
        <p className="text-lg font-bold text-heading mt-0.5">Admin</p>
      </div>

      {groups.map((g) => (
        <div key={g.label} className="pt-4 pb-1">
          <p className="px-4 mb-1 text-[9px] font-bold tracking-[1.5px] uppercase text-muted">{g.label}</p>
          {g.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-4 py-2 text-[13px] border-l-2 transition-colors ${
                  isActive
                    ? 'border-accent text-accent bg-accent/10'
                    : 'border-transparent text-text hover:bg-white/5 hover:text-heading'
                }`
              }
            >
              <span className="w-4 text-center text-[15px]">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}
