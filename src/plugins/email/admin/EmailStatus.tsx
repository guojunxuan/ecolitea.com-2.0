import type { PayloadRequest, ServerProps } from 'payload'
import { getEmailConfiguration } from '../config'

/** Public Payload UI-field server component; never serialize the resolved credential. */
export async function EmailStatus({
  payload,
  user,
  req,
}: Pick<ServerProps, 'payload' | 'user'> & { req?: PayloadRequest }) {
  if (user?.role !== 'admin') return null
  const { source, status } = await getEmailConfiguration(payload, req)
  const sourceLabel =
    source === 'env'
      ? 'Environment variables'
      : source === 'settings'
        ? 'Site Settings'
        : 'Not configured'
  return (
    <div className="email-status">
      <p>Source: {sourceLabel}</p>
      {source === 'env' && (
        <p>
          SMTP fields are read-only while SMTP_HOST is set. Environment variables override the saved
          email settings.
        </p>
      )}
      {status === 'undecryptable' && <p>Needs re-entry: replace the saved SMTP password.</p>}
      {status === 'invalid' && (
        <p>Email configuration is invalid. Check the active SMTP settings.</p>
      )}
      {status === 'missing' && <p>Complete the SMTP host and sender address to enable email.</p>}
    </div>
  )
}
