import { AnimatePresence } from 'framer-motion'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { useTheme } from './hooks/useTheme'
import { Home } from './pages/Home'
import { MeuCard } from './pages/MeuCard'
import { Entrega } from './pages/Entrega'
import { Indicar } from './pages/Indicar'
import { Perfil } from './pages/Perfil'
import { Transferir } from './pages/Transferir'
import { Extrato } from './pages/Extrato'
import { Coins } from './pages/Coins'
import { Quiz } from './pages/Quiz'
import { Cadastro } from './pages/Cadastro'
import { Documento } from './pages/Documento'
import { Selfie } from './pages/Selfie'
import { Garantia } from './pages/Garantia'
import { ContaCriada } from './pages/ContaCriada'
import { OnboardingProvider } from './hooks/useOnboarding'

export default function App() {
  const { theme, toggle } = useTheme()
  const location = useLocation()
  const onboarding = ['/quiz', '/cadastro', '/documento', '/selfie', '/garantia', '/conta-criada'].includes(location.pathname)

  return (
    <OnboardingProvider>
    <div className="min-h-dvh sm:py-6 flex justify-center">
      {/* Moldura do app: largura máxima 430px, fundo cinza em volta */}
      <div className="relative w-full max-w-[430px] min-h-dvh sm:min-h-[860px] sm:h-[calc(100dvh-48px)] sm:rounded-[36px] bg-muted dark:bg-dark-bg text-ink dark:text-white overflow-hidden sm:shadow-[0_30px_80px_rgba(0,0,0,0.25)] sm:border-[8px] sm:border-[#1a1a1a]">
        <main className={`h-full overflow-y-auto no-scrollbar ${onboarding ? 'pb-6' : 'pb-[120px]'}`}>
          <AnimatePresence mode="wait" initial={false}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Home theme={theme} onToggleTheme={toggle} />} />
              <Route path="/card" element={<MeuCard />} />
              <Route path="/entrega" element={<Entrega />} />
              <Route path="/indicar" element={<Indicar />} />
              <Route path="/perfil" element={<Perfil theme={theme} onToggleTheme={toggle} />} />
              <Route path="/transferir" element={<Transferir />} />
              <Route path="/extrato" element={<Extrato />} />
              <Route path="/coins" element={<Coins />} />
              <Route path="/quiz" element={<Quiz />} />
              <Route path="/cadastro" element={<Cadastro />} />
              <Route path="/documento" element={<Documento />} />
              <Route path="/selfie" element={<Selfie />} />
              <Route path="/garantia" element={<Garantia />} />
              <Route path="/conta-criada" element={<ContaCriada />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </main>
        {!onboarding && <BottomNav />}
      </div>
    </div>
    </OnboardingProvider>
  )
}
