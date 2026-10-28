import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

const base = (size?: number) => ({
  width: size ?? 24,
  height: size ?? 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const MoonIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
)
export const SunIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
)
export const HeadsetIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 14v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="13" width="4" height="6" rx="2" /><rect x="17" y="13" width="4" height="6" rx="2" /><path d="M19 19a3 3 0 0 1-3 3h-2" /></svg>
)
export const BellIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
)
export const SearchIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
export const UserIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
)
export const UsersIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-5-6.7" /></svg>
)
export const CameraIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
)
export const EyeIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
)
export const EyeOffIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3 3l18 18" /><path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" /><path d="M9.9 5.2A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.3 6.3C3.6 8.2 2 12 2 12s3.5 7 10 7c1.6 0 3-.3 4.2-.9" /></svg>
)
export const GearIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
)
export const ChevronRightIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="m9 6 6 6-6 6" /></svg>
)
export const ArrowLeftIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
)
export const ArrowRightIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M5 12h14M12 5l7 7-7 7" /></svg>
)
export const RefreshIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M16 9.5A5 5 0 0 0 7.5 10M8 14.5a5 5 0 0 0 8.5-.5" /><path d="M16 6v3.5h-3.5M8 18v-3.5h3.5" /></svg>
)
export const HomeIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M12 13v3" /></svg>
)
export const CardIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18M7 15h3" /></svg>
)
export const SendIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M21 3 10 14" /><path d="M21 3 14 21l-4-7-7-4z" /></svg>
)
export const PixIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12 3 7 8l5 5 5-5z" /><path d="M12 11l-5 5 5 5 5-5z" /><path d="M4 12 2.5 10.5M20 12l1.5-1.5" opacity=".0" /></svg>
)
export const PixDiamondIcon = ({ size, ...p }: P) => (
  <svg width={size ?? 24} height={size ?? 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" {...p}>
    <path d="M12 2.5 7.2 7.3 12 12l4.8-4.7z" /><path d="M12 12l-4.8 4.7L12 21.5l4.8-4.8z" /><path d="M7.2 7.3 2.5 12l4.7 4.7M16.8 7.3 21.5 12l-4.7 4.7" />
  </svg>
)
export const CoinIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5h3.2a1.8 1.8 0 0 1 0 3.6H11a1.8 1.8 0 0 0 0 3.6h3.5" /></svg>
)
export const SwapIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 7h13M14 4l3 3-3 3" /><path d="M20 17H7M10 14l-3 3 3 3" /></svg>
)
export const PlusIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12 5v14M5 12h14" /></svg>
)
export const PlusCircleIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>
)
export const ListIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></svg>
)
export const SplitIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 11h18M8 15h2M14 15h2" /></svg>
)
export const CopyIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h10" /></svg>
)
export const CheckIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="m5 12 5 5L20 7" /></svg>
)
export const LockIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
)
export const FileIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>
)
export const WalletIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3 7a2 2 0 0 1 2-2h13v4" /><rect x="3" y="7" width="18" height="13" rx="2" /><circle cx="16.5" cy="13.5" r="1.2" fill="currentColor" stroke="none" /></svg>
)
export const ShieldIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></svg>
)
export const LogoutIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" /><path d="M15 16l4-4-4-4M19 12H9" /></svg>
)
export const StarIcon = ({ size, ...p }: P) => (
  <svg width={size ?? 24} height={size ?? 24} viewBox="0 0 24 24" fill="currentColor" {...p}><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" /></svg>
)
export const ContactlessIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M6.5 8.5a6 6 0 0 1 0 7M9.5 10a3 3 0 0 1 0 4M12.5 7a9 9 0 0 1 0 10M15.5 5a12 12 0 0 1 0 14" /></svg>
)
export const TruckIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></svg>
)
export const PhoneIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M11 18h2" /></svg>
)
export const MailIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3 7 9 6 9-6" /></svg>
)
export const IdIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="12" r="2.2" /><path d="M14 10h4M14 14h4M5.5 17a3.5 3.5 0 0 1 7 0" /></svg>
)
export const QrIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3M21 14v3h-3M14 21h3M21 21h-1" /></svg>
)
