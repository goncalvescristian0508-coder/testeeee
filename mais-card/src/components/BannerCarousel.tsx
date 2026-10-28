import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CardVirtual } from './CardVirtual'
import { banners, formatBRL } from '../data/mock'

export function BannerCarousel() {
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / el.clientWidth)
      setIndex(Math.max(0, Math.min(banners.length - 1, i)))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const goTo = (i: number) => {
    const el = ref.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div>
      <div ref={ref} className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 gap-4 scroll-px-4">
        {banners.map((b) => (
          <article key={b.id} className="card snap-center shrink-0 w-full p-5 flex gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-[22px] leading-[1.15] font-extrabold">{b.titulo}</h2>
              <p className="mt-2 text-[13.5px] leading-snug text-subtle">{b.texto}</p>
              <p className="mt-3 text-[13.5px] text-subtle">{b.rotulo}</p>
              <p className="text-[28px] leading-none font-extrabold mt-1">{formatBRL(b.valor)}</p>
            </div>
            <div className="flex flex-col items-end justify-between shrink-0 gap-3">
              <CardVirtual variant={b.variante} size="sm" />
              <button type="button" className="btn-pill w-[150px] py-2.5 px-3 text-[12.5px] whitespace-nowrap" onClick={() => navigate(b.to)}>
                {b.cta}
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="flex justify-center gap-2 mt-3" role="tablist" aria-label="Banners">
        {banners.map((b, i) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Banner ${i + 1}`}
            onClick={() => goTo(i)}
            className={`h-2 rounded-full transition-all duration-300 ${i === index ? 'w-2.5 bg-brand' : 'w-2 bg-neutral-300 dark:bg-neutral-600'}`}
          />
        ))}
      </div>
    </div>
  )
}
