import { createContext, useContext, useMemo, useState } from 'react'
import type { Endereco, VerificacaoIdentidade } from '../services/types'

export type OnboardingData = {
  respostas: Record<string, string>
  nome: string
  cpf: string
  email: string
  celular: string
  senha: string
  endereco: Endereco
  documento: string
  docFrente: boolean
  docVerso: boolean
  selfie: boolean
  identidade: VerificacaoIdentidade | null
  valorGarantia: number
  diaVencimento: number
}

const inicial: OnboardingData = {
  respostas: {},
  nome: '',
  cpf: '',
  email: '',
  celular: '',
  senha: '',
  endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' },
  documento: '',
  docFrente: false,
  docVerso: false,
  selfie: false,
  identidade: null,
  valorGarantia: 100,
  diaVencimento: 10,
}

type Ctx = { data: OnboardingData; update: (patch: Partial<OnboardingData>) => void; reset: () => void }

const OnboardingContext = createContext<Ctx | null>(null)

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<OnboardingData>(inicial)
  const value = useMemo<Ctx>(
    () => ({
      data,
      update: (patch) => setData((d) => ({ ...d, ...patch })),
      reset: () => setData(inicial),
    }),
    [data],
  )
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error('useOnboarding precisa do OnboardingProvider')
  return ctx
}
