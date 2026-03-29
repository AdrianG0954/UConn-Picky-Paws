import { Outlet } from 'react-router-dom'
import { SiteHeader } from './SiteHeader'

export function Layout() {
  return (
    <div className="flex min-h-svh flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="mt-auto border-t border-zinc-200 bg-white/80 px-4 py-6 text-center dark:border-zinc-800 dark:bg-zinc-900/80">
        <p className="mx-auto max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          We are not officially affiliated with the University of Connecticut. This project is made by
          UConn students.
        </p>
      </footer>
    </div>
  )
}
