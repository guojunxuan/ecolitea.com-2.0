import { createHash } from 'node:crypto'
import nodemailer from 'nodemailer'
import addressparser from 'nodemailer/lib/addressparser'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import type { Payload, PayloadEmailAdapter, SendEmailOptions } from 'payload'
import { getEmailConfiguration, type EmailConfiguration } from './config'

export type EmailDeliveryResult = { status: 'sent' | 'skipped' | 'failed'; error?: string }
type EmailTransport = {
  sendMail: (message: SendEmailOptions) => Promise<unknown>
  close?: () => void
}
type AdapterOptions = {
  resolveConfiguration?: (payload: Payload) => Promise<EmailConfiguration>
  createTransport?: (options: SMTPTransport.Options) => EmailTransport
  timeoutMs?: number
}

/** SMTP error text can contain credentials, commands, and message content. Use known codes only. */
function deliveryError(error: unknown): string {
  const { code, responseCode } = (error ?? {}) as { code?: string; responseCode?: number }
  const reasons: Record<string, string> = {
    EAUTH: 'SMTP authentication failed',
    ECONNECTION: 'SMTP connection failed',
    ECONNREFUSED: 'SMTP connection refused',
    EDNS: 'SMTP hostname could not be resolved',
    ETIMEDOUT: 'Email delivery timed out',
    ESOCKET: 'SMTP connection failed',
    ETLS: 'SMTP TLS negotiation failed',
    EENVELOPE: 'SMTP sender or recipient was rejected',
    EMESSAGE: 'SMTP message was rejected',
  }
  const reason = (code && reasons[code]) || 'Email delivery failed'
  const smtpCode =
    Number.isInteger(responseCode) && responseCode! >= 400 && responseCode! <= 599
      ? ` (${responseCode})`
      : ''
  return `${reason}${smtpCode}.`
}

function recipients(message: SendEmailOptions) {
  const readAddresses = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.flatMap(readAddresses)
    const text =
      typeof value === 'string'
        ? value
        : value &&
            typeof value === 'object' &&
            'address' in value &&
            typeof value.address === 'string'
          ? value.address
          : ''
    return addressparser(text, { flatten: true })
      .map(({ address }) => address)
      .filter(Boolean)
  }
  const addresses = [message.to, message.cc, message.bcc].flatMap(readAddresses)
  return {
    recipientCount: addresses.length,
    recipientDomains: [...new Set(addresses.map((address) => address.split('@')[1]))],
  }
}

export function createEmailAdapter(
  options: AdapterOptions = {},
): PayloadEmailAdapter<EmailDeliveryResult> {
  const resolveConfiguration = options.resolveConfiguration ?? getEmailConfiguration
  const createTransport =
    options.createTransport ?? ((config) => nodemailer.createTransport(config))
  const timeoutMs = options.timeoutMs ?? 10000
  return ({ payload }) => {
    let cached: { key: string; transport: EmailTransport } | undefined
    return {
      name: 'dynamic-smtp',
      defaultFromAddress: 'noreply@example.invalid',
      defaultFromName: 'Website',
      sendEmail: async (message) => {
        const cancellation = new AbortController()
        let expired = false
        let sending: EmailTransport | undefined
        let configuration: EmailConfiguration | undefined
        let timer: ReturnType<typeof setTimeout> | undefined
        const timedOut: EmailDeliveryResult = {
          status: 'failed',
          error: 'Email delivery timed out.',
        }
        const attempt = async (): Promise<EmailDeliveryResult> => {
          try {
            configuration = await resolveConfiguration(payload)
            if (expired) return timedOut
            if (
              configuration.status !== 'configured' ||
              !configuration.connection ||
              !configuration.from
            ) {
              return {
                status: 'skipped',
                error:
                  configuration.status === 'undecryptable'
                    ? 'SMTP password needs re-entry.'
                    : configuration.status === 'invalid'
                      ? 'Email configuration is invalid.'
                      : 'Email is not configured.',
              }
            }
            const connection = configuration.connection
            const key = createHash('sha256').update(JSON.stringify(connection)).digest('hex')
            if (cached?.key !== key) {
              // Non-pooled SMTP transports are lightweight; do not close an older in-flight send.
              cached = {
                key,
                transport: createTransport({
                  host: connection.host,
                  port: connection.port,
                  secure: connection.security === 'tls',
                  requireTLS: connection.security === 'starttls',
                  ignoreTLS: connection.security === 'none',
                  ...(connection.user
                    ? { auth: { user: connection.user, pass: connection.password ?? '' } }
                    : {}),
                  connectionTimeout: timeoutMs,
                  greetingTimeout: timeoutMs,
                  socketTimeout: timeoutMs,
                  disableFileAccess: true,
                  disableUrlAccess: true,
                }),
              }
            }
            sending = cached.transport
            await sending.sendMail({
              ...message,
              signal: message.signal
                ? AbortSignal.any([message.signal, cancellation.signal])
                : cancellation.signal,
              from: { address: configuration.from.address, name: configuration.from.name ?? '' },
              disableFileAccess: true,
              disableUrlAccess: true,
            })
            return { status: 'sent' }
          } catch (error) {
            return { status: 'failed', error: deliveryError(error) }
          }
        }
        const result = await Promise.race([
          attempt(),
          new Promise<EmailDeliveryResult>((resolve) => {
            timer = setTimeout(() => {
              expired = true
              cancellation.abort()
              try {
                sending?.close?.()
              } catch {
                /* Delivery failure stays non-fatal. */
              }
              if (cached?.transport === sending) cached = undefined
              resolve(timedOut)
            }, timeoutMs)
          }),
        ])
        clearTimeout(timer)
        if (result.status !== 'sent') {
          let subject = message.subject ?? ''
          for (const credential of [
            configuration?.connection?.password,
            configuration?.connection?.user,
          ]) {
            if (credential) subject = subject.split(credential).join('[redacted]')
          }
          subject = subject.replace(/[\r\n\0]/g, ' ').slice(0, 200)
          const metadata = {
            ...recipients(message),
            subject,
            reason: result.error,
            msg: 'Outbound email was not sent',
          }
          // A logger failure must not reject a business write either.
          try {
            payload.logger[result.status === 'skipped' ? 'warn' : 'error'](metadata)
          } catch {
            /* Non-fatal. */
          }
        }
        return result
      },
    }
  }
}
