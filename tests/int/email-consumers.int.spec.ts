// @vitest-environment node
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { randomUUID } from 'node:crypto'
import {
  buildConfig,
  getPayload,
  type CollectionSlug,
  type Payload,
  type SendEmailOptions,
} from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { QuoteRequests } from '@/collections/QuoteRequests'
import { Users } from '@/collections/Users'
import { plugins } from '@/plugins'
import { createEmailAdapter } from '@/plugins/email/adapter'
import { getServerSideURL } from '@/utilities/getURL'
import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'

const fixtureTag = `email-consumers-${randomUUID()}`
const databaseURI = createIsolatedTestDatabaseURI(fixtureTag)
// Exercise values omitted in REST JSON despite the persisted Local API type being string.
const omittedValue = undefined as unknown as string
const richText = (text: string) => ({
  root: {
    type: 'root' as const,
    version: 1,
    children: [
      {
        type: 'paragraph' as const,
        version: 1,
        textFormat: 0,
        textStyle: '',
        children: [
          {
            type: 'text' as const,
            version: 1,
            text,
            format: 0,
            detail: 0,
            mode: 'normal' as const,
            style: '',
          },
        ],
        direction: null,
        format: '' as const,
        indent: 0,
      },
    ],
    direction: null,
    format: '' as const,
    indent: 0,
  },
})

describe('email consumers through installed Payload APIs', () => {
  let payload: Payload
  let formID: string
  let failingTransport = false
  const messages: SendEmailOptions[] = []
  const created: Array<{ collection: CollectionSlug; id: string }> = []
  const remember = <T extends { id: string }>(collection: CollectionSlug, doc: T): T => {
    created.push({ collection, id: doc.id })
    return doc
  }

  beforeAll(async () => {
    expect(process.env.DISABLE_R2_STORAGE).toBe('true')
    vi.stubEnv('JOBS_AUTORUN', 'false')
    expect(process.env.JOBS_AUTORUN).toBe('false')
    console.info(
      `Email consumer test target: ${databaseURI}; storage disabled; injected mail only.`,
    )
    const configuredFormBuilder = plugins.find(
      (plugin) => plugin.slug === '@payloadcms/plugin-form-builder',
    )
    expect(configuredFormBuilder).toBeDefined()
    const config = await buildConfig({
      telemetry: false,
      typescript: { autoGenerate: false },
      secret: 'email-consumers-isolated-test-secret-at-least-32-characters',
      serverURL: 'https://cms.example.invalid',
      routes: { admin: '/manage' },
      admin: { routes: { reset: '/recover' } },
      editor: lexicalEditor(),
      collections: [Users, { slug: 'products', fields: [] }, QuoteRequests],
      plugins: [configuredFormBuilder!],
      jobs: { autoRun: [] },
      db: mongooseAdapter({
        url: databaseURI,
        connectOptions: { serverSelectionTimeoutMS: 3000 },
      }),
      email: createEmailAdapter({
        resolveConfiguration: async () => ({
          source: 'env',
          status: 'configured',
          connection: { host: 'smtp.example.invalid', port: 1025, security: 'none' },
          from: { address: 'website@example.invalid', name: 'Website tests' },
        }),
        createTransport: () => ({
          sendMail: async (message) => {
            messages.push(message)
            if (failingTransport) throw new Error('private SMTP response password=do-not-log')
            return { messageId: fixtureTag }
          },
        }),
      }),
    })
    payload = await getPayload({ config, key: fixtureTag })
    const form = await payload.create({
      collection: 'forms',
      data: {
        title: fixtureTag,
        fields: [
          { blockType: 'text', name: 'name', label: 'Name', required: true },
          { blockType: 'email', name: 'email', label: 'Email', required: true },
          { blockType: 'select', name: 'topic', options: [{ label: 'Tea', value: 'tea' }] },
          { blockType: 'number', name: 'quantity' },
          { blockType: 'checkbox', name: 'updates' },
        ],
        confirmationMessage: richText('Thank you'),
        emails: [
          {
            emailTo: 'sales@example.invalid',
            emailFrom: 'form@example.invalid',
            replyTo: '{{email}}',
            subject: 'New enquiry from {{name}}',
            message: richText('Customer: {{name}}; Email: {{email}}'),
          },
        ],
      },
      overrideAccess: true,
    })
    formID = remember('forms', form).id
  }, 20000)

  afterEach(() => {
    failingTransport = false
    messages.length = 0
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    if (!payload) return
    console.info(`Cleaning only ${fixtureTag} document IDs in ${databaseURI}.`)
    try {
      for (const { collection, id } of created.reverse()) {
        await payload.delete({ collection, id, overrideAccess: true })
      }
    } finally {
      await payload.destroy()
    }
  })

  const submitForm = async () =>
    remember(
      'form-submissions',
      await payload.create({
        collection: 'form-submissions',
        data: {
          form: formID,
          submissionData: [
            { field: 'name', value: 'Ada' },
            { field: 'email', value: 'ada@example.invalid' },
          ],
        },
        overrideAccess: true,
      }),
    )

  it('keeps per-form email configuration enabled and sends using the project adapter', async () => {
    expect(payload.collections.forms.config.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'emails', type: 'array' })]),
    )
    const saved = await submitForm()
    expect(
      await payload.findByID({
        collection: 'form-submissions',
        id: saved.id,
        overrideAccess: true,
      }),
    ).toMatchObject({
      id: saved.id,
    })
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      to: 'sales@example.invalid',
      from: { address: 'website@example.invalid', name: 'Website tests' },
      replyTo: 'ada@example.invalid',
      subject: 'New enquiry from Ada',
    })
    expect(messages[0].html).toContain('Customer: Ada; Email: ada@example.invalid')
  })

  it('accepts empty optional values without removing meaningful zero or false', async () => {
    const saved = remember(
      'form-submissions',
      await payload.create({
        collection: 'form-submissions',
        data: {
          form: formID,
          submissionData: [
            { field: 'name', value: 'Ada' },
            { field: 'email', value: 'ada@example.invalid' },
            { field: 'topic', value: omittedValue },
            { field: 'quantity', value: '0' },
            { field: 'updates', value: 'false' },
          ],
        },
        overrideAccess: true,
      }),
    )
    expect(saved.submissionData).toEqual([
      expect.objectContaining({ field: 'name', value: 'Ada' }),
      expect.objectContaining({ field: 'email', value: 'ada@example.invalid' }),
      expect.objectContaining({ field: 'quantity', value: '0' }),
      expect.objectContaining({ field: 'updates', value: 'false' }),
    ])
  })

  it('omits blank optional select, number and checkbox values on server writes', async () => {
    const saved = remember(
      'form-submissions',
      await payload.create({
        collection: 'form-submissions',
        data: {
          form: formID,
          submissionData: [
            { field: 'name', value: 'Ada' },
            { field: 'email', value: 'ada@example.invalid' },
            { field: 'topic', value: omittedValue },
            { field: 'quantity', value: '' },
            { field: 'updates', value: omittedValue },
          ],
        },
        overrideAccess: true,
      }),
    )
    expect(saved.submissionData?.map((row) => row.field)).toEqual(['name', 'email'])
  })

  it.each(['missing', 'empty', 'whitespace'])(
    'rejects a %s required value on the server',
    async (kind) => {
      const submissionData = [{ field: 'email', value: 'ada@example.invalid' }]
      if (kind !== 'missing')
        submissionData.push({ field: 'name', value: kind === 'empty' ? '' : '   ' })
      await expect(
        payload
          .create({
            collection: 'form-submissions',
            data: { form: formID, submissionData },
            overrideAccess: true,
          })
          .then((doc) => remember('form-submissions', doc)),
      ).rejects.toMatchObject({ name: 'ValidationError' })
      expect(messages).toHaveLength(0)
    },
  )

  it.each(['select', 'number', 'checkbox'] as const)(
    'enforces a required %s on the server',
    async (blockType) => {
      const fields =
        blockType === 'select'
          ? [
              {
                blockType,
                name: 'required',
                required: true,
                options: [{ label: 'Tea', value: 'tea' }],
              },
            ]
          : [{ blockType, name: 'required', required: true }]
      const form = remember(
        'forms',
        await payload.create({
          collection: 'forms',
          data: {
            title: `${fixtureTag}-${blockType}`,
            fields,
            emails: [],
            confirmationMessage: richText('Thank you'),
          },
          overrideAccess: true,
        }),
      )
      for (const submissionData of [
        [],
        [{ field: 'required', value: blockType === 'checkbox' ? 'false' : '' }],
      ]) {
        await expect(
          payload
            .create({
              collection: 'form-submissions',
              data: { form: form.id, submissionData },
              overrideAccess: true,
            })
            .then((doc) => remember('form-submissions', doc)),
        ).rejects.toMatchObject({ name: 'ValidationError' })
      }
      const saved = remember(
        'form-submissions',
        await payload.create({
          collection: 'form-submissions',
          data: {
            form: form.id,
            submissionData: [
              {
                field: 'required',
                value: blockType === 'checkbox' ? 'true' : blockType === 'number' ? '0' : 'tea',
              },
            ],
          },
          overrideAccess: true,
        }),
      )
      expect(saved.id).toBeTruthy()
    },
  )

  it('still saves a form submission when the actual adapter transport fails', async () => {
    failingTransport = true
    const logger = vi.spyOn(payload.logger, 'error').mockImplementation(() => undefined)
    const saved = await submitForm()
    expect(
      await payload.findByID({
        collection: 'form-submissions',
        id: saved.id,
        overrideAccess: true,
      }),
    ).toMatchObject({
      id: saved.id,
    })
    expect(messages).toHaveLength(1)
    expect(logger).toHaveBeenCalledOnce()
    expect(JSON.stringify(logger.mock.calls)).not.toContain('do-not-log')
  })

  it('still saves a quote when the actual adapter transport fails', async () => {
    failingTransport = true
    vi.spyOn(payload, 'findGlobal').mockResolvedValueOnce({
      salesEmail: 'sales@example.invalid',
    } as never)
    vi.spyOn(payload.logger, 'error').mockImplementation(() => undefined)
    vi.spyOn(payload.logger, 'warn').mockImplementation(() => undefined)
    const saved = remember(
      'quote-requests',
      await payload.create({
        collection: 'quote-requests',
        data: {
          name: fixtureTag,
          email: 'ada@example.invalid',
          company: 'Tea company',
          message: 'Need 500 units',
          productTitle: 'Paper Bag',
          productSlug: 'bag',
          status: 'new',
        },
        overrideAccess: true,
      }),
    )
    expect(
      await payload.findByID({ collection: 'quote-requests', id: saved.id, overrideAccess: true }),
    ).toMatchObject({
      id: saved.id,
      name: fixtureTag,
    })
    expect(messages).toHaveLength(1)
    expect(messages[0].replyTo).toBe('ada@example.invalid')
  })

  it('still saves a quote when its notification settings cannot be loaded', async () => {
    vi.spyOn(payload, 'findGlobal').mockRejectedValueOnce(new Error('private database error'))
    vi.spyOn(payload.logger, 'warn').mockImplementation(() => undefined)
    const saved = remember(
      'quote-requests',
      await payload.create({
        collection: 'quote-requests',
        data: {
          name: fixtureTag,
          email: 'ada@example.invalid',
          company: 'Tea company',
          message: 'Need 500 units',
          status: 'new',
        },
        overrideAccess: true,
      }),
    )
    expect(
      await payload.findByID({ collection: 'quote-requests', id: saved.id, overrideAccess: true }),
    ).toMatchObject({
      id: saved.id,
    })
    expect(messages).toHaveLength(0)
  })

  it('generates the built-in password reset URL using serverURL and configured Admin routes', async () => {
    const user = await payload.create({
      collection: 'users',
      data: {
        email: `${fixtureTag}@example.invalid`,
        password: 'isolated-test-password',
        role: 'editor',
      },
      overrideAccess: true,
    })
    remember('users', user)
    const token = await payload.forgotPassword({
      collection: 'users',
      data: { email: user.email },
      overrideAccess: true,
    })
    expect(token).toMatch(/^[a-f0-9]{40}$/)
    expect(messages).toHaveLength(1)
    expect(messages[0].to).toBe(user.email)
    expect(messages[0].html).toContain(`https://cms.example.invalid/manage/recover/${token}`)
    expect(messages[0].from).toEqual({ address: 'website@example.invalid', name: 'Website tests' })
  })

  it('wires the public server URL into the real application config for native reset emails', async () => {
    const config = await (await import('@/payload.config')).default
    expect(config.serverURL).toBe(getServerSideURL())
  })
})
