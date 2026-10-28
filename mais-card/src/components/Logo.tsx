type GlyphProps = { color: string }

/**
 * Marca "MAIS card" desenhada em SVG puro (viewBox 0 0 135 64).
 * Posições calculadas a partir das larguras reais dos glifos da Nunito 800/44px.
 */
export function LogoGlyph({ color }: GlyphProps) {
  return (
    <g fill={color} fontFamily="Nunito, Arial, sans-serif">
      <text x="0" y="40" fontSize="44" fontWeight={800}>MA</text>
      {/* "ı" sem pontinho: o "+" sobrescrito faz o papel do ponto */}
      <text x="73" y="40" fontSize="44" fontWeight={800}>ı</text>
      <text x="85" y="40" fontSize="44" fontWeight={800}>S</text>
      <path d="M78 5.5v10M73 10.5h10" stroke={color} strokeWidth="3.4" strokeLinecap="round" fill="none" />
      {/* traço na base do A */}
      <rect x="58" y="36.5" width="11" height="3.4" rx="1.7" />
      <text x="66" y="60" fontSize="14" fontWeight={600} letterSpacing="4">card</text>
      <rect x="114" y="55" width="12" height="3.2" rx="1.6" />
    </g>
  )
}

type Props = { color?: string; height?: number; className?: string }

export function Logo({ color = '#0F0F0F', height = 40, className }: Props) {
  const width = (height * 135) / 64
  return (
    <svg width={width} height={height} viewBox="0 0 135 64" className={className} role="img" aria-label="MAIS card">
      <LogoGlyph color={color} />
    </svg>
  )
}
