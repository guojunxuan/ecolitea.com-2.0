import type { MigrateUpArgs, MongooseAdapter } from '@payloadcms/db-mongodb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  planProductDetailMigration,
  planProductSettingsMigration,
  scanProductDetailMigration,
  up,
} from '@/migrations/20261109_product_detail_specs'
import {
  assertLocalDatabaseURI,
  buildProductDetailReport,
  parseReportArguments,
} from '../../scripts/report-product-detail-specs'

afterEach(() => vi.unstubAllEnvs())

describe('product detail migration plans', () => {
  const rows = [
    { id: 'old1', label: 'Finish', value: 'Black' },
    { id: 'old2', label: 'Voltage', value: '230 V' },
  ]

  it.each(['', 'version.'])(
    'wraps flat specifications and retires only owned fields at %s',
    (prefix) => {
      const product = {
        specifications: rows,
        options: [],
        highlights: null,
        inquiry: {},
        sections: [],
      }
      const doc = { _id: 'record', ...(prefix ? { version: product } : product) }
      const plan = planProductDetailMigration(doc, Boolean(prefix), 'up')
      expect(plan.set).toEqual({
        [`${prefix}specifications`]: [
          { id: expect.stringMatching(/^[0-9a-f]{24}$/), group: null, items: rows },
        ],
      })
      expect(plan.unset).toEqual({
        [`${prefix}options`]: '',
        [`${prefix}highlights`]: '',
        [`${prefix}inquiry`]: '',
      })
      expect(plan.issues).toEqual([])
      const grouped = { specifications: plan.set[`${prefix}specifications`] }
      const migrated = { _id: 'record', ...(prefix ? { version: grouped } : grouped) }
      expect(planProductDetailMigration(migrated, Boolean(prefix), 'up')).toMatchObject({
        set: {},
        unset: {},
        issues: [],
      })
    },
  )

  it.each([undefined, null, []])('leaves empty specifications unchanged (%j)', (specifications) => {
    expect(planProductDetailMigration({ specifications }, false, 'up')).toMatchObject({
      set: {},
      unset: {},
      issues: [],
    })
  })

  it.each([
    [rows[0], { group: null, items: rows }],
    [{ label: 'Both shapes', value: 'Ambiguous', items: rows }],
    [{ group: 'Broken', items: [{ unexpected: true }] }],
    { label: 'Not an array' },
  ])('blocks unexpected or mixed specifications (%j)', (specifications) => {
    const plan = planProductDetailMigration({ specifications }, false, 'up')
    expect(plan.issues).not.toHaveLength(0)
    expect(plan.set).toEqual({})
  })

  it('flattens all groups in order while keeping item IDs and leaves retired fields unrestored', () => {
    const specifications = [
      { id: 'group1', group: 'General', items: [rows[0]] },
      { id: 'group2', group: 'Electrical', items: [rows[1]] },
    ]
    expect(planProductDetailMigration({ specifications }, false, 'down')).toMatchObject({
      set: { specifications: rows },
      unset: {},
      issues: [],
    })
    expect(planProductDetailMigration({ specifications: rows }, false, 'down').set).toEqual({})
  })
})

describe('Settings product migration plans', () => {
  it('converts slide themes and preserves inactive CTA data while removing retired presentation fields', () => {
    const cta = { label: 'Retained', url: '/contact', type: 'custom' }
    const doc = {
      version: {
        product: {
          hero: { enabled: true, heading: 'Previous hero' },
          inquiry: { buttons: [] },
          heroSlides: [
            {
              id: 'a',
              title: 'A',
              theme: 'inverse',
              media: 'image-a',
              eyebrow: 'Old',
              position: 'right',
              enableCta: false,
              cta,
            },
            { id: 'b', title: 'B', theme: 'default', media: 'image-b' },
            { id: 'c', title: 'C', theme: 'dark', media: 'image-c' },
            { id: 'd', title: 'D', theme: 'light', media: 'image-d' },
          ],
          categoryCarousel: { enabled: false },
        },
      },
    }
    const plan = planProductSettingsMigration(doc, true, 'up')
    expect(plan).toMatchObject({
      set: {
        'version.product.heroSlides': [
          { id: 'a', title: 'A', theme: 'dark', media: 'image-a', enableCta: false, cta },
          { id: 'b', title: 'B', theme: 'light', media: 'image-b' },
          { id: 'c', title: 'C', theme: 'dark', media: 'image-c' },
          { id: 'd', title: 'D', theme: 'light', media: 'image-d' },
        ],
      },
      unset: { 'version.product.inquiry': '', 'version.product.hero': '' },
      issues: [],
    })
    expect(plan.set['version.product.heroSlides']).toEqual([
      { id: 'a', title: 'A', theme: 'dark', media: 'image-a', enableCta: false, cta },
      { id: 'b', title: 'B', theme: 'light', media: 'image-b' },
      { id: 'c', title: 'C', theme: 'dark', media: 'image-c' },
      { id: 'd', title: 'D', theme: 'light', media: 'image-d' },
    ])
  })

  it('preserves active fallback as a text slide when there is no carousel', () => {
    const plan = planProductSettingsMigration(
      {
        _id: 'settings',
        product: {
          hero: {
            enabled: true,
            heading: ' Our products ',
            description: 'Desc',
            headerTheme: 'dark',
          },
        },
      },
      false,
      'up',
    )
    expect(plan).toMatchObject({
      set: {
        'product.heroSlides': [
          {
            id: expect.stringMatching(/^[0-9a-f]{24}$/),
            title: 'Our products',
            description: 'Desc',
            showText: true,
            theme: 'dark',
            enableCta: false,
          },
        ],
      },
      unset: { 'product.hero': '' },
      issues: [],
    })
    expect(
      planProductSettingsMigration(
        { product: { heroSlides: plan.set['product.heroSlides'] } },
        false,
        'up',
      ),
    ).toMatchObject({
      set: {},
      unset: {},
      issues: [],
    })
  })

  it('blocks cleanup when only incomplete slides compete with an active fallback', () => {
    const product = {
      hero: { enabled: true, heading: 'Visible fallback', image: 'cover-id' },
      heroSlides: [{ title: 'Missing image', enableCta: false }],
    }
    expect(planProductSettingsMigration({ product }, false, 'up').issues).toContainEqual(
      expect.objectContaining({ path: 'product.hero' }),
    )
  })

  it('moves desktop and mobile media from the legacy Settings Hero', () => {
    const version = {
      product: {
        hero: {
          enabled: true,
          heading: 'Featured',
          headerTheme: 'default',
          image: 'desktop-id',
          mobileMedia: 'mobile-id',
        },
      },
    }
    expect(planProductSettingsMigration({ version }, true, 'up')).toMatchObject({
      set: {
        'version.product.heroSlides': [
          {
            title: 'Featured',
            theme: 'light',
            showText: true,
            media: 'desktop-id',
            mobileMedia: 'mobile-id',
          },
        ],
      },
      issues: [],
    })
  })

  it('leaves Settings alone in the partial rollback', () => {
    const product = { heroSlides: [{ title: 'A', showText: true, theme: 'dark' }] }
    expect(planProductSettingsMigration({ product }, false, 'down')).toMatchObject({
      set: {},
      unset: {},
      issues: [],
    })
  })
})

describe('migration preflight and execution', () => {
  const collection = (name: string, documents: Record<string, unknown>[]) => ({
    collectionName: name,
    find: vi.fn(async function* () {
      yield* documents
    }),
    bulkWrite: vi.fn(async () => ({ matchedCount: 1 })),
  })
  const migrationFixture = (settingsVersion: Record<string, unknown> = {}) => {
    const products = collection('products', [
      { _id: 'p', specifications: [{ label: 'L', value: 'V' }], inquiry: null },
    ])
    const versions = collection('_products_versions', [{ _id: 'v', version: {} }])
    const globals = collection('globals', [
      { _id: 'g', globalType: 'settings', product: { inquiry: {} } },
    ])
    const settingsVersions = collection('_settings_versions', [
      { _id: 's', version: settingsVersion },
    ])
    const adapter = {
      collections: { products: { collection: products } },
      globals: { collection: globals },
      versions: { products: { collection: versions }, settings: { collection: settingsVersions } },
      connection: {
        host: '127.0.0.1',
        port: 27017,
        db: { databaseName: 'ecolitea2' },
        base: { mongo: { BSON: { EJSON: { stringify: JSON.stringify } } } },
      },
    } as unknown as MongooseAdapter
    const args = { payload: { db: adapter, logger: { info: vi.fn() } } } as unknown as MigrateUpArgs
    return { adapter, args, products, versions, globals, settingsVersions }
  }

  it('counts all four targets, scopes the Global query, and guards exact source snapshots', async () => {
    const { adapter, globals, products } = migrationFixture()
    const report = await scanProductDetailMigration(adapter, 'up')
    expect(
      report.collections.map(({ collection, scanned, toChangeDocuments }) => [
        collection,
        scanned,
        toChangeDocuments,
      ]),
    ).toEqual([
      ['products', 1, 1],
      ['_products_versions', 1, 0],
      ['globals', 1, 1],
      ['_settings_versions', 1, 0],
    ])
    expect(globals.find).toHaveBeenCalledWith({ globalType: 'settings' }, {})
    expect(report.writes[0].operations[0].updateOne.filter).toMatchObject({
      _id: 'p',
      $and: expect.arrayContaining([
        { inquiry: { $exists: true } },
        { $expr: { $eq: ['$inquiry', { $literal: null }] } },
        { options: { $exists: false } },
        { $expr: { $eq: ['$specifications', { $literal: [{ label: 'L', value: 'V' }] }] } },
      ]),
    })
    expect(report.allowedToWrite).toBe(true)
    expect(products.bulkWrite).not.toHaveBeenCalled()
  })

  it('changes the approval fingerprint when retired data changes without changing the counts', async () => {
    const before = migrationFixture({ product: { inquiry: { buttons: ['original'] } } })
    const after = migrationFixture({ product: { inquiry: { buttons: ['changed'] } } })
    const original = await buildProductDetailReport(before.adapter)
    const changed = await buildProductDetailReport(after.adapter)
    expect(original).not.toHaveProperty('writes')
    expect(changed.toChangeDocuments).toBe(original.toChangeDocuments)
    expect(changed.fingerprint).not.toBe(original.fingerprint)
  })

  it('blocks all writes when a later Settings version has unexpected slide data', async () => {
    const { args, products, settingsVersions } = migrationFixture({
      product: { heroSlides: 'malformed' },
    })
    await expect(up(args)).rejects.toThrow(/blocking data/)
    expect(products.bulkWrite).not.toHaveBeenCalled()
    expect(settingsVersions.bulkWrite).not.toHaveBeenCalled()
  })

  it('requires the exact approved preflight and stops on a concurrent edit before later targets', async () => {
    const { adapter, args, products, globals } = migrationFixture()
    await expect(up(args)).rejects.toThrow(/confirmed dry-run fingerprint/)
    expect(products.bulkWrite).not.toHaveBeenCalled()
    const report = await scanProductDetailMigration(adapter, 'up')
    vi.stubEnv('PRODUCT_DETAIL_SPECS_APPROVED_FINGERPRINT', report.fingerprint)
    products.bulkWrite.mockResolvedValueOnce({ matchedCount: 0 })
    await expect(up(args)).rejects.toThrow(/Concurrent change/)
    expect(globals.bulkWrite).not.toHaveBeenCalled()
  })

  it('rejects URI redirection, production and nonreport arguments before initializing', () => {
    expect(parseReportArguments(['--direction=down'])).toBe('down')
    expect(parseReportArguments(['--apply'])).toBe('apply')
    expect(() => parseReportArguments(['--apply', '--direction=down'])).toThrow()
    expect(() => parseReportArguments(['--execute'])).toThrow()
    expect(() =>
      assertLocalDatabaseURI('mongodb://127.0.0.1:27017/ecolitea2?replicaSet=elsewhere'),
    ).toThrow()
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => assertLocalDatabaseURI('mongodb://127.0.0.1:27017/ecolitea2')).toThrow()
  })
})
