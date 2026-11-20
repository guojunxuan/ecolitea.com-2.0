// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import {
  buildConfig,
  createPayloadRequest,
  getPayload,
  handleEndpoints,
  type Payload,
} from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Users } from '@/collections/Users'
import { SiteSettings } from '@/SiteSettings/config'
import { integrationFields } from '@/SiteSettings/fields/integrations'
import { emailFields, emailNotificationFields } from '@/SiteSettings/fields/email'
import { getIntegrations } from '@/SiteSettings/integrations'
import { up } from '@/migrations/20261116_user_roles'
import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'
import type { User } from '@/payload-types'

describe('integration access through real Payload operations', () => {
  let payload: Payload
  let admin: User
  let editor: User
  let otherEditor: User
  const cacheKey = `ecolitea2-integrations-int-${randomUUID()}`
  const request = async (user?: User) =>
    createPayloadRequest({ user, context: { disableRevalidate: true }, payload })
  beforeAll(async () => {
    vi.stubEnv('SMTP_HOST', '')
    expect(process.env.DISABLE_R2_STORAGE).toBe('true')
    const url = createIsolatedTestDatabaseURI(cacheKey)
    process.stdout.write(
      `Integrations DB test target: ${url}; storage: disabled, no remote adapters\n`,
    )
    payload = await getPayload({
      key: cacheKey,
      config: buildConfig({
        telemetry: false,
        secret: 'isolated-integrations-test-secret-32-characters',
        typescript: { autoGenerate: false },
        db: mongooseAdapter({ url, connectOptions: { serverSelectionTimeoutMS: 3000 } }),
        collections: [Users],
        globals: [
          {
            ...SiteSettings,
            hooks: { ...SiteSettings.hooks, afterChange: [] },
            fields: [
              ...integrationFields,
              ...emailFields,
              ...emailNotificationFields,
              { name: 'disableGtm', type: 'checkbox' },
            ],
          },
        ],
      }),
    })
    const first = await handleEndpoints({
      config: payload.config,
      payloadInstanceCacheKey: cacheKey,
      request: new Request('http://localhost/api/users/first-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.test', password: 'isolated-password' }),
      }),
    })
    expect(first.status).toBe(200)
    const registered = await first.json()
    expect(registered.user.role).toBe('admin')
    expect(
      JSON.parse(Buffer.from(registered.token.split('.')[1], 'base64url').toString()).role,
    ).toBe('admin')
    admin = registered.user
    editor = await payload.create({
      collection: 'users',
      req: await request(admin),
      overrideAccess: false,
      data: { email: 'editor@example.test', password: 'isolated-password' } as never,
    })
    otherEditor = await payload.create({
      collection: 'users',
      req: await request(admin),
      overrideAccess: false,
      data: { email: 'other-editor@example.test', password: 'isolated-password' } as never,
    })
  }, 15000)
  afterAll(async () => {
    vi.unstubAllEnvs()
    if (!payload) return
    await (payload.db as MongooseAdapter).connection.dropDatabase()
    await payload.destroy()
  })
  it('promotes the first user and defaults subsequent users to editor', () => {
    expect(admin.role).toBe('admin')
    expect(editor.role).toBe('editor')
  })
  describe('Users access boundaries', () => {
    it('prevents editors from taking over another account through its password', async () => {
      await expect(
        payload.update({
          collection: 'users',
          id: admin.id,
          data: { password: 'editor-controlled-password' },
          overrideAccess: false,
          req: await request(editor),
        }),
      ).rejects.toMatchObject({ status: 403 })
      const login = await payload.login({
        collection: 'users',
        data: { email: admin.email, password: 'isolated-password' },
      })
      expect(login.user?.id).toBe(admin.id)
      await expect(
        payload.login({
          collection: 'users',
          data: { email: admin.email, password: 'editor-controlled-password' },
        }),
      ).rejects.toMatchObject({ status: 401 })
    })
    it.each([{ email: 'editor-controlled@example.test' }, { role: 'editor' as const }])(
      'prevents editors from changing another account with %j',
      async (data) => {
        await expect(
          payload.update({
            collection: 'users',
            id: admin.id,
            data,
            overrideAccess: false,
            req: await request(editor),
          }),
        ).rejects.toMatchObject({ status: 403 })
        expect(await payload.findByID({ collection: 'users', id: admin.id })).toMatchObject({
          email: admin.email,
          role: 'admin',
        })
      },
    )
    it('prevents editors from creating accounts with the default role', async () => {
      await expect(
        payload.create({
          collection: 'users',
          data: { email: 'editor-created@example.test', password: 'isolated-password' } as never,
          overrideAccess: false,
          req: await request(editor),
        }),
      ).rejects.toMatchObject({ status: 403 })
      expect(
        (
          await payload.count({
            collection: 'users',
            where: { email: { equals: 'editor-created@example.test' } },
          })
        ).totalDocs,
      ).toBe(0)
    })
    it.each(['self', 'other'] as const)(
      'prevents editors from deleting %s accounts',
      async (target) => {
        const id = target === 'self' ? editor.id : otherEditor.id
        await expect(
          payload.delete({
            collection: 'users',
            id,
            overrideAccess: false,
            req: await request(editor),
          }),
        ).rejects.toMatchObject({ status: 403 })
        expect((await payload.findByID({ collection: 'users', id })).id).toBe(id)
      },
    )
    it('allows editors to change their own name and password', async () => {
      const changed = await payload.update({
        collection: 'users',
        id: editor.id,
        data: { name: 'Editor self update', password: 'editor-new-password' },
        overrideAccess: false,
        req: await request(editor),
      })
      expect(changed).toMatchObject({ id: editor.id, name: 'Editor self update', role: 'editor' })
      const login = await payload.login({
        collection: 'users',
        data: { email: editor.email, password: 'editor-new-password' },
      })
      expect(login.user?.id).toBe(editor.id)
    })
    it('limits editor bulk updates to their own account', async () => {
      const changed = await payload.update({
        collection: 'users',
        where: { id: { in: [admin.id, editor.id] } },
        data: { name: 'Editor bulk update' },
        overrideAccess: false,
        req: await request(editor),
      })
      expect(changed.errors).toEqual([])
      expect(changed.docs.map(({ id }) => id)).toEqual([editor.id])
      expect((await payload.findByID({ collection: 'users', id: admin.id })).name).not.toBe(
        'Editor bulk update',
      )
    })
    it('preserves authenticated reads of other accounts', async () => {
      const read = await payload.findByID({
        collection: 'users',
        id: admin.id,
        overrideAccess: false,
        req: await request(editor),
      })
      expect(read.id).toBe(admin.id)
    })
    it('allows administrators to create, update, and delete other accounts', async () => {
      const created = await payload.create({
        collection: 'users',
        data: { email: 'admin-managed@example.test', password: 'isolated-password' } as never,
        overrideAccess: false,
        req: await request(admin),
      })
      expect(created.role).toBe('editor')
      const changed = await payload.update({
        collection: 'users',
        id: created.id,
        data: {
          name: 'Admin managed',
          email: 'admin-updated@example.test',
          password: 'admin-updated-password',
          role: 'admin',
        },
        overrideAccess: false,
        req: await request(admin),
      })
      expect(changed).toMatchObject({
        name: 'Admin managed',
        email: 'admin-updated@example.test',
        role: 'admin',
      })
      const login = await payload.login({
        collection: 'users',
        data: { email: changed.email, password: 'admin-updated-password' },
      })
      expect(login.user?.id).toBe(created.id)
      const deleted = await payload.delete({
        collection: 'users',
        id: created.id,
        overrideAccess: false,
        req: await request(admin),
      })
      expect(deleted.id).toBe(created.id)
    })
    it('refuses first-user registration after bootstrap', async () => {
      const response = await handleEndpoints({
        config: payload.config,
        payloadInstanceCacheKey: cacheKey,
        request: new Request('http://localhost/api/users/first-register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'late-bootstrap@example.test',
            password: 'isolated-password',
          }),
        }),
      })
      expect(response.status).toBe(403)
    })
  })
  it.each([false, true])(
    'rejects editor role escalation with overrideAccess=%s',
    async (overrideAccess) => {
      await expect(
        payload.update({
          collection: 'users',
          id: editor.id,
          data: { role: 'admin' },
          req: await request(editor),
          overrideAccess,
        }),
      ).rejects.toMatchObject({ status: 400 })
      await expect(
        payload.create({
          collection: 'users',
          data: { email: 'escalate@example.test', password: 'isolated-password', role: 'admin' },
          req: await request(editor),
          overrideAccess,
        }),
      ).rejects.toMatchObject({ status: overrideAccess ? 400 : 403 })
      expect((await payload.findByID({ collection: 'users', id: editor.id })).role).toBe('editor')
    },
  )
  it('allows editor native forms to echo their unchanged role', async () => {
    const changed = await payload.update({
      collection: 'users',
      id: editor.id,
      data: { role: 'editor', name: 'Updated editor' },
      overrideAccess: false,
      req: await request(editor),
    })
    expect(changed).toMatchObject({ role: 'editor', name: 'Updated editor' })
  })
  it('lets admins replace, preserves on unrelated save, and hides secrets from API reads', async () => {
    const saved = await payload.updateGlobal({
      slug: 'site-settings',
      data: { googleTranslateApiKeyInput: 'isolated-key-1234', gtmContainerId: ' GTM-TEST123 ' },
      overrideAccess: false,
      req: await request(admin),
    })
    expect(saved.googleTranslateApiKeyEncrypted).toBeUndefined()
    expect(saved.googleTranslateApiKeyLast4).toBe('1234')
    expect(saved.googleTranslateApiKeyInput).toBeNull()
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { disableGtm: true },
      overrideAccess: false,
      req: await request(editor),
    })
    expect((await getIntegrations(payload)).translate).toMatchObject({
      apiKey: 'isolated-key-1234',
      status: 'configured',
    })
    const stored = await (payload.db as MongooseAdapter).connection
      .db!.collection('globals')
      .findOne({ globalType: 'site-settings' })
    expect(JSON.stringify(stored)).not.toContain('isolated-key-1234')
    expect(stored).not.toHaveProperty('googleTranslateApiKeyInput')
    const publicResponse = await handleEndpoints({
      config: payload.config,
      payloadInstanceCacheKey: cacheKey,
      request: new Request('http://localhost/api/globals/site-settings'),
    })
    expect(publicResponse.status).toBe(200)
    const publicData = await publicResponse.json()
    expect(publicData.gtmContainerId).toBe('GTM-TEST123')
    for (const field of [
      'googleTranslateApiKeyEncrypted',
      'googleTranslateApiKeyLast4',
      'googleTranslateApiKeyInput',
    ])
      expect(publicData).not.toHaveProperty(field)
    const read = await payload.findGlobal({
      slug: 'site-settings',
      overrideAccess: false,
      req: await request(editor),
    })
    expect(read.googleTranslateApiKeyEncrypted).toBeUndefined()
    expect(read.googleTranslateApiKeyLast4).toBeUndefined()
  })
  it('rejects editor key changes and direct protected-field writes', async () => {
    for (const data of [
      { googleTranslateApiKeyInput: 'attacker' },
      { googleTranslateApiKeyClear: true },
      { googleTranslateApiKeyEncrypted: 'attacker' },
      { googleTranslateApiKeyLast4: 'fake' },
    ]) {
      await expect(
        payload.updateGlobal({
          slug: 'site-settings',
          data,
          overrideAccess: false,
          req: await request(editor),
        }),
      ).rejects.toMatchObject({ status: 400 })
    }
    await expect(
      payload.updateGlobal({
        slug: 'site-settings',
        data: { googleTranslateApiKeyEncrypted: 'forged' },
        overrideAccess: false,
        req: await request(admin),
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect((await getIntegrations(payload)).translate.apiKey).toBe('isolated-key-1234')
  })
  it('lets admin clear both credential fields', async () => {
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { googleTranslateApiKeyClear: true },
      overrideAccess: false,
      req: await request(admin),
    })
    expect((await getIntegrations(payload)).translate.status).toBe('missing')
    const saved = await payload.findGlobal({ slug: 'site-settings', overrideAccess: true })
    expect(saved.googleTranslateApiKeyEncrypted).toBeNull()
    expect(saved.googleTranslateApiKeyLast4).toBeNull()
  })
  it('protects SMTP secrets and private connection fields through real public REST and editor reads', async () => {
    const saved = await payload.updateGlobal({
      slug: 'site-settings',
      data: {
        smtpHost: 'smtp.example.test',
        smtpFromAddress: 'noreply@example.test',
        smtpPasswordInput: 'isolated-smtp-password-9876',
      },
      overrideAccess: false,
      req: await request(admin),
    })
    expect(saved.smtpPasswordEncrypted).toBeUndefined()
    expect(saved.smtpPasswordLast4).toBe('9876')
    expect(saved.smtpPasswordInput).toBeNull()
    const stored = await (payload.db as MongooseAdapter).connection
      .db!.collection('globals')
      .findOne({ globalType: 'site-settings' })
    expect(JSON.stringify(stored)).not.toContain('isolated-smtp-password-9876')
    expect(stored).not.toHaveProperty('smtpPasswordInput')
    const response = await handleEndpoints({
      config: payload.config,
      payloadInstanceCacheKey: cacheKey,
      request: new Request('http://localhost/api/globals/site-settings'),
    })
    expect(response.status).toBe(200)
    const publicData = await response.json()
    const read = await payload.findGlobal({
      slug: 'site-settings',
      overrideAccess: false,
      req: await request(editor),
    })
    for (const field of [
      'smtpPasswordEncrypted',
      'smtpPasswordLast4',
      'smtpPasswordInput',
      'smtpHost',
      'smtpUser',
    ]) {
      expect(publicData).not.toHaveProperty(field)
      expect(read).not.toHaveProperty(field)
    }
    for (const overrideAccess of [false, true])
      for (const data of [
        { smtpPasswordInput: 'attacker' },
        { smtpPasswordClear: true },
        { smtpPasswordEncrypted: 'forged' },
        { smtpPasswordLast4: 'fake' },
      ]) {
        await expect(
          payload.updateGlobal({
            slug: 'site-settings',
            data,
            overrideAccess,
            req: await request(editor),
          }),
        ).rejects.toMatchObject({ status: 400 })
      }
    for (const data of [{ smtpPasswordEncrypted: 'forged' }, { smtpPasswordLast4: 'fake' }]) {
      await expect(
        payload.updateGlobal({
          slug: 'site-settings',
          data,
          overrideAccess: false,
          req: await request(admin),
        }),
      ).rejects.toMatchObject({ status: 400 })
    }
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { disableGtm: false },
      overrideAccess: false,
      req: await request(editor),
    })
    expect(
      (await payload.findGlobal({ slug: 'site-settings', overrideAccess: true })).smtpPasswordLast4,
    ).toBe('9876')
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { smtpPasswordClear: true },
      overrideAccess: false,
      req: await request(admin),
    })
    const cleared = await payload.findGlobal({ slug: 'site-settings', overrideAccess: true })
    expect(cleared.smtpPasswordEncrypted).toBeNull()
    expect(cleared.smtpPasswordLast4).toBeNull()
  })
  it('migrates every existing user to admin', async () => {
    await up({ payload, req: await request() } as Parameters<typeof up>[0])
    expect(
      (await payload.find({ collection: 'users', pagination: false })).docs.every(
        (user) => user.role === 'admin',
      ),
    ).toBe(true)
  })
})
