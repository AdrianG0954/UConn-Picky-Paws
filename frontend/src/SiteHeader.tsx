import { NavLink } from 'react-router-dom'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-lg px-5 py-2 text-base font-medium lowercase tracking-wide transition-colors',
    isActive
      ? 'bg-violet-100 text-violet-800 dark:bg-violet-950/80 dark:text-violet-200'
      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
  ].join(' ')

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/90">
      <nav
        className="mx-auto flex max-w-6xl justify-center gap-2 px-4 py-4 sm:gap-8"
        aria-label="Main"
      >
        <NavLink to="/rank" className={linkClass} end>
          rank
        </NavLink>
        <NavLink to="/leaderboard" className={linkClass}>
          leaderboard
        </NavLink>
      </nav>
    </header>
  )
}
