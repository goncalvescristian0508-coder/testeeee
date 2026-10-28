import { TopBar } from '../components/TopBar'
import { Timeline } from '../components/Timeline'
import { CardVirtual } from '../components/CardVirtual'
import { PageTransition } from '../components/PageTransition'
import { TruckIcon } from '../components/Icons'
import { cartao, etapasEntrega } from '../data/mock'

export function Entrega() {
  const idx = etapasEntrega.findIndex((e) => e.id === cartao.status)
  return (
    <PageTransition>
      <TopBar title="Acompanhar entrega" backTo="/" />
      <div className="px-4 pt-5 pb-4 space-y-4">
        <section className="card-cream p-5 flex items-center gap-4 fade-up">
          <CardVirtual size="sm" />
          <div className="min-w-0">
            <p className="text-[12.5px] text-subtle">Status do cartão</p>
            <p className="text-[18px] font-extrabold leading-tight mt-0.5">{cartao.statusLabel}</p>
            <p className="text-[12.5px] text-subtle mt-1">Etapa {idx + 1} de {etapasEntrega.length}</p>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-[17px] font-extrabold mb-5">Etapas da entrega</h2>
          <Timeline steps={etapasEntrega} currentId={cartao.status} />
        </section>

        <section className="card p-5 flex items-center gap-4 fade-up delay-4">
          <span className="w-12 h-12 rounded-full bg-brand text-ink grid place-items-center shrink-0"><TruckIcon size={24} /></span>
          <div>
            <p className="font-extrabold">Previsão de entrega</p>
            <p className="text-[13px] text-subtle">Entre 03/11 e 10/11/2026 · Rua das Flores, 123 · São Paulo/SP</p>
          </div>
        </section>
      </div>
    </PageTransition>
  )
}
