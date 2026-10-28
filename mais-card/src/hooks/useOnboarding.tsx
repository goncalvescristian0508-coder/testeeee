import { createContext, useContext, useMemo, useState } from 'react'

export type OnboardingData = {
  respostas: Record<string, string>
  nome: string
  cpf: string
  email: string
  celular: string
  documento: string
  docFrente: boolean
  docVerso: boolean
  selfie: boolean
  valorGarantia: number
}

const inicial: OnboardingData = {
  respostas: {},
  nome: '',
  cpf: '',
  email: '',
  celular: '',
  documento: '',
  docFrente: false,
  docVerso: false,
  selfie: false,
  valorGarantia: 100,
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
