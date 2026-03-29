import type { DishInfo } from './types'

type Props = {
  dish: DishInfo
  selected: boolean
  disabled: boolean
  onSelect: () => void
  onShowNutrition: () => void
}

export function DishCard({ dish, selected, disabled, onSelect, onShowNutrition }: Props) {
  return (
    <article
      className={[
        'flex min-h-[22rem] flex-col rounded-3xl border p-8 text-left shadow-md transition-shadow md:min-h-[26rem] md:p-10 lg:min-h-[28rem]',
        selected
          ? 'border-violet-500 ring-4 ring-violet-500/35 dark:border-violet-400'
          : 'border-zinc-200 dark:border-zinc-600',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-violet-300 dark:hover:border-violet-600',
      ].join(' ')}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        className="grow text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 dark:focus-visible:ring-offset-zinc-950"
      >
        <h3 className="text-2xl font-semibold leading-tight text-zinc-900 dark:text-zinc-50 md:text-3xl lg:text-4xl">
          {dish.dish_name}
        </h3>
        <p className="mt-3 text-base text-zinc-600 md:text-lg dark:text-zinc-400">{dish.dining_hall_name}</p>
        <p className="mt-8 text-lg font-medium text-zinc-700 md:text-xl dark:text-zinc-300">
          ELO:{' '}
          <span className="tabular-nums text-2xl font-semibold text-violet-600 md:text-3xl dark:text-violet-400">
            {formatElo(dish.elo_rating)}
          </span>
        </p>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          onShowNutrition()
        }}
        className="mt-6 w-full rounded-xl border border-zinc-200 bg-zinc-50 py-4 text-base font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 md:text-lg dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      >
        Nutritional info
      </button>
    </article>
  )
}

function formatElo(r: number): string {
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}
