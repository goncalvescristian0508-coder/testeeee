import { ContactlessIcon } from './Icons'
import { LogoGlyph } from './Logo'

type Props = {
  variant?: 'preto' | 'amarelo'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { w: 'w-[150px]', h: 'h-[94px]', chip: 'w-6 h-5', logo: 30, radius: 'rounded-[12px]', nfc: 12, brand: 11 },
  md: { w: 'w-[220px]', h: 'h-[138px]', chip: 'w-9 h-7', logo: 44, radius: 'rounded-[16px]', nfc: 16, brand: 16 },
  lg: { w: 'w-[300px]', h: 'h-[188px]', chip: 'w-12 h-9', logo: 60, radius: 'rounded-[22px]', nfc: 20, brand: 22 },
}

/** Cartão virtual MAIS Card (retrato do cartão real, mas em CSS/SVG). */
export function CardVirtual({ variant = 'preto', size = 'md', className = '' }: Props) {
  const s = sizes[size]
  const isBlack = variant === 'preto'
  const bg = isBlack
    ? 'bg-[#0b0b0b] bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,0.08),transparent_55%)]'
    : 'bg-brand bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,0.35),transparent_55%)]'
  const fg = isBlack ? '#F5C21B' : '#0F0F0F'
  const sub = isBlack ? 'text-white/80' : 'text-ink/80'
  const logoW = (s.logo * 135) / 64

  return (
    <div
      className={`relative ${s.w} ${s.h} ${s.radius} ${bg} shadow-[0_14px_35px_rgba(0,0,0,0.3)] overflow-hidden select-none ${className}`}
      aria-label={`Cartão MAIS Card ${variant}`}
    >
      {/* Contactless + chip */}
      <div className="absolute left-[14%] top-[24%] flex flex-col items-center gap-1.5">
        <ContactlessIcon size={s.nfc} className={sub} />
        <div className={`${s.chip} rounded-[5px] bg-[linear-gradient(135deg,#f3dc9b,#c89b3c_55%,#e9c56f)] relative overflow-hidden`}>
          <div className="absolute inset-x-0 top-1/2 h-px bg-black/30" />
          <div className="absolute inset-y-0 left-1/3 w-px bg-black/30" />
          <div className="absolute inset-y-0 right-1/3 w-px bg-black/30" />
        </div>
      </div>

      {/* Logo na vertical */}
      <div className="absolute right-[6%] top-[52%] -translate-y-1/2 -rotate-90 origin-center" style={{ width: logoW, height: s.logo, marginRight: (logoW - s.logo) / 2 - s.logo * 0.1 }}>
        <svg width={logoW} height={s.logo} viewBox="0 0 135 64" aria-hidden="true">
          <LogoGlyph color={fg} />
        </svg>
      </div>

      {/* Placeholder genérico de bandeira (dois círculos) */}
      <div className="absolute right-[7%] top-[8%] flex flex-col items-center" aria-hidden="true">
        <span className="block rounded-full bg-[#F79E1B]/90" style={{ width: s.brand, height: s.brand }} />
        <span className="block rounded-full bg-[#EB001B]/90" style={{ width: s.brand, height: s.brand, marginTop: -s.brand * 0.35 }} />
      </div>
    </div>
  )
}
