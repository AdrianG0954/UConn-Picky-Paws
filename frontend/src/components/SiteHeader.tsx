import { NavLink } from 'react-router-dom';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-lg px-5 py-2 text-base font-medium lowercase tracking-wide transition-colors',
    isActive
      ? 'bg-uconn-navy/10 text-uconn-navy'
      : 'text-zinc-600 hover:bg-zinc-100 hover:text-uconn-navy',
  ].join(' ');

export function SiteHeader() {
  return (
    <header className='border-b border-zinc-200 bg-white shadow-sm'>
      <nav
        className='mx-auto flex max-w-6xl justify-center gap-2 px-4 py-4 sm:gap-8'
        aria-label='Main'
      >
        <NavLink to='/rank' className={linkClass} end>
          rank
        </NavLink>
        <NavLink to='/leaderboard' className={linkClass}>
          leaderboard
        </NavLink>
      </nav>
    </header>
  );
}
