import { useState } from 'react'
import { PageTransition } from '../components/PageTransition'
import { TopBar } from '../components/TopBar'
import { Toast } from '../components/Toast'
import { PixDiamondIcon, QrIcon, SendIcon, WalletIcon, PlusCircleIcon } from '../components/Icons'
import { formatBRL } from '../data/mock'
import { api } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { useToast } from '../hooks/useToast'

export function Transferir() {
  const { message, show } = useToast()
  const [valor, setValor] = useState('')
  const [chave, setChave] = useState('')
  const carteira = useAsync(() => api.getCarteira())

  const enviar = async () => {
    if (!valor || !chave) return show('Preencha a chave e o valor')
    const num = Number(valor.replace(',', '.'))
    if (!num || num <= 0) return show('Valor inválido')
    if (carteira.data && num > carteira.data.saldoDisponivel) return show('Saldo insuficiente')
    await api.enviarPix(chave, num)
    carteira.reload()
    show(`Pix de ${formatBRL(num)} enviado`)
    setValor('')
    setChave('')
  }

  return (
    <PageTransition>
      <TopBar title="Pix e transferências" backTo="/" />
      <div className="px-4 pt-5 pb-4 space-y-4">
        <section className="card p-5 fade-up">
          <p className="text-[12.5px] text-subtle">Saldo disponível</p>
          <p className="text-[26px] font-extrabold">{carteira.data ? formatBRL(carteira.data.saldoDisponivel) : '—'}</p>
        </section>

        <section className="grid grid-cols-4 gap-2 fade-up delay-1">
          {[
            { label: 'Pix', Icon: PixDiamondIcon },
            { label: 'Ler QR', Icon: QrIcon },
            { label: 'Conta+', Icon: WalletIcon },
            { label: 'Depositar', Icon: PlusCircleIcon },
          ].map(({ label, Icon }) => (
            <button key={label} type="button" onClick={() => show(`${label} em breve`)} className="card p-3 flex flex-col items-center gap-2 text-[12px] font-bold active:scale-95 transition">
              <span className="w-11 h-11 rounded-full bg-brand text-ink grid place-items-center"><Icon size={22} /></span>
              {label}
            </button>
          ))}
        </section>

        <section className="card p-5 space-y-4 fade-up delay-2">
          <h2 className="text-[17px] font-extrabold">Enviar Pix</h2>
          <label className="block">
            <span className="text-[12.5px] text-subtle">Chave Pix</span>
            <input
              value={chave}
              onChange={(e) => setChave(e.target.value)}
              placeholder="CPF, e-mail, celular ou aleatória"
              className="mt-1 w-full rounded-2xl bg-muted dark:bg-white/5 px-4 py-3 text-[15px] font-semibold outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
          <label className="block">
            <span className="text-[12.5px] text-subtle">Valor</span>
            <div className="mt-1 flex items-center rounded-2xl bg-muted dark:bg-white/5 px-4">
              <span className="font-extrabold text-subtle">R$</span>
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value.replace(/[^\d,]/g, ''))}
                inputMode="decimal"
                placeholder="0,00"
                className="w-full bg-transparent py-3 pl-2 text-[22px] font-extrabold outline-none"
              />
            </div>
          </label>
          <button type="button" onClick={enviar} className="btn-pill w-full gap-2"><SendIcon size={18} /> Enviar agora</button>
        </section>
      </div>
      <Toast message={message} />
    </PageTransition>
  )
}
