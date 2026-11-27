import type { SVGProps } from 'react'

export function GlobeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
      width="24"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18M5 6.5c4.2 2 9.8 2 14 0M5 17.5c4.2-2 9.8-2 14 0" />
    </svg>
  )
}
