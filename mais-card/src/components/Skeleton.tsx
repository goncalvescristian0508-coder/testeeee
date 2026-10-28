/** Placeholder de carregamento, no formato do conteúdo que vai aparecer. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`block rounded-xl bg-neutral-200/80 dark:bg-white/10 animate-pulse ${className}`} />
}
