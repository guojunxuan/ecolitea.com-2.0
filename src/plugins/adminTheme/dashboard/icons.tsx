import type { ReactNode } from 'react'

// Decorative 16px stroke icons. The text next to each one carries the meaning.
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

export const ProductIcon = () => <Icon><path d="M3 5.5 8 3l5 2.5v5L8 13l-5-2.5z" /><path d="M3 5.5 8 8l5-2.5M8 8v5" /></Icon>
export const MailIcon = () => <Icon><path d="M2.5 4.5h11v7h-11z" /><path d="m2.5 5 5.5 4 5.5-4" /></Icon>
export const DocumentIcon = () => <Icon><path d="M4 2.5h6l2.5 2.5v8.5H4z" /><path d="M6 8h4M6 10.5h4" /></Icon>
export const GlobeIcon = () => <Icon><circle cx="8" cy="8" r="5.5" /><path d="M2.5 8h11M8 2.5c2 2 2 9 0 11M8 2.5c-2 2-2 9 0 11" /></Icon>
export const CalendarIcon = () => <Icon><rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></Icon>
export const PlusIcon = () => <Icon><path d="M8 3v10M3 8h10" /></Icon>
export const PenIcon = () => <Icon><path d="m4 12 1-3 6-6 2 2-6 6z" /></Icon>
export const UploadIcon = () => <Icon><path d="M8 11V3M5 6l3-3 3 3M3 13h10" /></Icon>
export const ClockIcon = () => <Icon><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3l2 1.5" /></Icon>
export const TranslateIcon = () => <Icon><path d="M3 4h6M6 4c0 4-2 6-3.5 7M4.5 7c1 2 2.5 3 4 3.5M9 13l2.5-6 2.5 6M10 11h3" /></Icon>
export const CloudIcon = () => <Icon><path d="M4.5 12.5a3 3 0 0 1-.5-6 4 4 0 0 1 7.7-1 3.2 3.2 0 0 1-.2 7z" /></Icon>

export const collectionIcons = {
  products: PlusIcon,
  blogs: PenIcon,
  media: UploadIcon,
} as const
