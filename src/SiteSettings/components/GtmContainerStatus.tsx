export function GtmContainerStatus() {
  return <p>Container: {process.env.NEXT_PUBLIC_GTM_MEASUREMENT_ID || 'Not configured'}</p>
}
