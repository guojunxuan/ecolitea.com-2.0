// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { extract } from '@/plugins/translation/extract'
import { merge } from '@/plugins/translation/merge'
import { siteSettingsRule } from '@/plugins/translation/rules/siteSettings'

describe('email integration translation exclusions', () => {
  const emailSettings = {
    smtpHost: 'smtp.example.invalid',
    smtpPort: 587,
    smtpSecurity: 'starttls',
    smtpUser: 'sender@example.invalid',
    smtpFromAddress: 'sender@example.invalid',
    smtpFromName: 'Ecolitea',
    smtpPasswordEncrypted: 'encrypted-test-secret',
    smtpPasswordLast4: 'last',
    smtpPasswordInput: 'write-only-test-secret',
    smtpPasswordClear: false,
    quoteNotificationsEnabled: true,
    quoteNotificationRecipients: [{ id: 'sales', email: 'sales@example.invalid' }],
  }

  it('explicitly excludes every connection, secret, and notification setting', () => {
    expect(siteSettingsRule).toMatchObject({
      smtpHost: 'exclude',
      smtpPort: 'exclude',
      smtpSecurity: 'exclude',
      smtpUser: 'exclude',
      smtpFromAddress: 'exclude',
      smtpFromName: 'exclude',
      smtpPasswordEncrypted: 'exclude',
      smtpPasswordLast4: 'exclude',
      smtpPasswordInput: 'exclude',
      smtpPasswordClear: 'exclude',
      emailStatus: 'exclude',
      smtpPasswordStatus: 'exclude',
      emailTest: 'exclude',
      quoteNotificationsEnabled: 'exclude',
      'quoteNotificationRecipients[].id': 'exclude',
      'quoteNotificationRecipients[].email': 'exclude',
    })
  })

  it('never extracts email configuration or applies translated email fields', () => {
    const settings = { ...emailSettings, tagline: 'Made for tea' }
    expect(extract(settings, siteSettingsRule)).toEqual([
      { path: 'tagline', kind: 'text', source: 'Made for tea' },
    ])
    expect(
      merge(
        settings,
        {
          tagline: 'Für Tee gemacht',
          smtpHost: 'translated-host',
          smtpFromName: 'Translated sender',
          smtpPasswordInput: 'translated-secret',
          'quoteNotificationRecipients[id=sales].email': 'other@example.invalid',
        },
        siteSettingsRule,
      ),
    ).toEqual({ ...emailSettings, tagline: 'Für Tee gemacht' })
  })
})
