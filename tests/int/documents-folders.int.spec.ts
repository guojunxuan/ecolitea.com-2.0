// @vitest-environment node
import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { randomUUID } from 'node:crypto'
import { buildConfig, getPayload, type Payload, type TextFieldValidation } from 'payload'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { Documents } from '@/collections/Documents'
import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'

let payload: Payload
let url: string
beforeAll(async () => {
  expect(process.env.DISABLE_R2_STORAGE).toBe('true')
  url = createIsolatedTestDatabaseURI(
    `ecolitea2-test-documents-folders-${randomUUID().slice(0, 16)}`,
    'mongodb://127.0.0.1:27017/ecolitea2-test',
  )
  console.info(`Documents folders target: ${url}; storage: disabled; DISABLE_R2_STORAGE=true`)
  payload = await getPayload({
    key: url,
    config: buildConfig({
      secret: 'isolated-documents-folders-at-least-32-characters',
      typescript: { autoGenerate: false },
      email: () => ({
        name: 'test',
        defaultFromAddress: 'test@example.invalid',
        defaultFromName: 'Test',
        sendEmail: async () => undefined,
      }),
      db: mongooseAdapter({ url, connectOptions: { serverSelectionTimeoutMS: 3000 } }),
      collections: [
        {
          slug: 'folders',
          folders: true,
          fields: [{ name: 'name', type: 'text', required: true }],
        },
        {
          ...Documents,
          fields: Documents.fields.map((field) =>
            field.type === 'text' && !field.hasMany && field.name === 'title'
              ? {
                  ...field,
                  validate: (
                    value: Parameters<TextFieldValidation>[0],
                    args: Parameters<TextFieldValidation>[1],
                  ) =>
                    args.req.context.seedLegacyTitle
                      ? true
                      : typeof field.validate === 'function'
                        ? field.validate(value, args)
                        : true,
                }
              : field,
          ),
          upload: {
            ...(Documents.upload as object),
            disableLocalStorage: true,
            filesRequiredOnCreate: false,
          },
          hooks: {
            ...Documents.hooks,
            beforeValidate: Documents.hooks?.beforeValidate?.map(
              (hook) => (args) => (args.req.context.seedLegacyTitle ? args.data : hook(args)),
            ),
          },
        },
      ],
    }),
  })
}, 15000)
afterAll(async () => {
  if (payload) {
    console.info(`Dropping isolated folders database: ${url}`)
    await (payload.db as MongooseAdapter).connection.dropDatabase()
    await payload.destroy()
  }
})
it('archives in the shared native folder tree and unfiles on actual folder deletion despite an invalid legacy title', async () => {
  const folder = await payload.create({ collection: 'folders', data: { name: 'Certifications' } })
  const doc = await payload.create({
    collection: 'documents',
    data: { title: 'document1' },
    context: { seedLegacyTitle: true },
  })
  await expect(
    payload.update({
      collection: 'documents',
      id: doc.id,
      data: { _h_folders: folder.id },
      depth: 0,
    }),
  ).resolves.toMatchObject({ title: 'document1', _h_folders: folder.id })
  await payload.delete({ collection: 'folders', id: folder.id })
  const unfiled = await payload.findByID({ collection: 'documents', id: doc.id, depth: 0 })
  expect(unfiled._h_folders ?? null).toBeNull()
  expect(unfiled.title).toBe('document1')
})
