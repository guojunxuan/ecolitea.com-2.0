import { expect, test, type Page } from '@playwright/test'
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { createFile } from 'mp4box'
import { getPayload, type Payload } from 'payload'
import config from '../../src/payload.config'
import { assertRunScopedE2EDatabaseURI } from '../helpers/e2eDatabase'
import { getE2EBaseURL } from '../helpers/e2eBaseURL'
import { login } from '../helpers/login'
import { browserPDF } from '../helpers/mediaDocumentsBrowserFixtures'
import { officeEntries, officeTypes, zip } from '../helpers/documentFixtures'

const baseURL = getE2EBaseURL()
const runID = process.env.PLAYWRIGHT_E2E_RUN_ID!
const prefix = `resources-${runID}`
const user = { email: `${prefix}@example.invalid`, password: 'isolated-browser-password' }
let payload: Payload

test.describe('Media and Documents native Admin workflows', () => {
  test.setTimeout(90_000)
  test.beforeAll(async () => {
    assertRunScopedE2EDatabaseURI(process.env.DATABASE_URI!, runID)
    expect(process.env.DISABLE_R2_STORAGE).toBe('true')
    console.info(
      `Resource browser target: ${process.env.DATABASE_URI}; storage: local .next-e2e/standalone/{media,documents}, unique ${prefix} files; R2 disabled.`,
    )
    payload = await getPayload({ config })
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: user.email } },
    })
    if (!existing.totalDocs) await payload.create({ collection: 'users', data: user })
  })
  test.beforeEach(async ({ page }) => {
    await page
      .context()
      .route(/^https?:/, (route) =>
        new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort(),
      )
    await login({ page, user })
  })
  test.afterAll(async ({ browser }) => {
    if (!payload) return
    const context = await browser.newContext()
    const response = await context.request.post(`${baseURL}/api/users/login`, { data: user })
    if (response.ok()) {
      for (const collection of ['media', 'documents'] as const) {
        const documents = await payload.find({
          collection,
          where: { filename: { contains: prefix } },
          limit: 100,
          depth: 0,
        })
        for (const document of documents.docs) {
          const deletion = await context.request.delete(
            `${baseURL}/api/${collection}/${document.id}`,
          )
          expect(deletion.ok(), `cleanup ${collection}/${document.id}`).toBe(true)
        }
      }
    }
    await context.close()
    await payload.delete({ collection: 'users', where: { email: { equals: user.email } } })
    await payload.destroy()
  })

  async function save(page: Page, collection: string) {
    const response = page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/${collection}`,
    )
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    const result = await response
    expect(await result.text()).toBeTruthy()
    expect(result.ok(), await result.text()).toBe(true)
    await expect(page).toHaveURL(new RegExp(`/admin/collections/${collection}/(?!create)[^/?]+`))
    return (await result.json()).doc
  }

  test('invalid image cancellation clears the file for cancel, close and Escape', async ({
    page,
  }) => {
    await page.goto(`${baseURL}/admin/collections/media/create`)
    const buffer = await sharp({
      create: { width: 1000, height: 210, channels: 3, background: '#5f805a' },
    })
      .png()
      .toBuffer()
    for (const action of ['Choose another file', 'Close', 'Escape']) {
      await page
        .locator('input[type=file]')
        .setInputFiles({ name: `${prefix}-invalid.png`, mimeType: 'image/png', buffer })
      const dialog = page.getByRole('dialog').filter({
        has: page.getByRole('heading', { name: 'Crop image to a supported ratio', exact: true }),
      })
      await expect(dialog).toBeVisible()
      await expect(dialog.getByText('Result: 373 × 210 · 16:9')).toBeVisible()
      if (action === 'Escape') await page.keyboard.press('Escape')
      else await dialog.getByRole('button', { name: action, exact: true }).click()
      await expect(dialog).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Select a file', exact: true })).toBeVisible()
    }
    await expect(page.getByText(/Images: JPEG/)).toHaveCount(0)
  })

  test('automatically crops an invalid image, saves dimensions, and retains native focus/download actions', async ({
    page,
  }) => {
    await page.goto(`${baseURL}/admin/collections/media/create`)
    const buffer = await sharp({
      create: { width: 1100, height: 1000, channels: 3, background: '#5f805a' },
    })
      .png()
      .toBuffer()
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: `${prefix}-garden.png`, mimeType: 'image/png', buffer })
    await expect(page.locator('input[name=alt]')).toHaveValue(`${prefix}-garden`)
    await page.locator('input[name=alt]').fill('Tea garden in spring')
    const dialog = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Crop image to a supported ratio', exact: true }),
    })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/This image is 1100 × 1000 \(1.10:1\)/)).toBeVisible()
    await expect(dialog.getByRole('document')).toBeVisible()
    const bounds = await dialog.getByRole('document').boundingBox()
    const viewport = page.viewportSize()!
    expect(Math.abs(bounds!.x + bounds!.width / 2 - viewport.width / 2)).toBeLessThan(3)
    expect(Math.abs(bounds!.y + bounds!.height / 2 - viewport.height / 2)).toBeLessThan(3)
    await dialog.getByRole('tab', { name: '16:9', exact: true }).click()
    await expect(dialog.getByRole('tab', { name: '16:9', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await dialog.getByRole('tab', { name: '1:1', exact: true }).click()
    await dialog.getByRole('button', { name: 'Apply crop' }).click()
    await page.evaluate(() => {
      const read = FileReader.prototype.readAsArrayBuffer
      FileReader.prototype.readAsArrayBuffer = function (blob) {
        window.setTimeout(() => read.call(this, blob), 500)
      }
    })
    const filename = page.getByRole('textbox', { name: 'File Name', exact: true })
    await filename.fill(`${prefix}-renamed-garden.png`)
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
    await expect(filename).toBeEnabled()
    await filename.press('Home')
    await filename.pressSequentially('tea-')
    await expect(dialog).toHaveCount(0)
    const doc = await save(page, 'media')
    expect(doc.filename).toBe(`tea-${prefix}-renamed-garden.png`)
    expect(doc).toMatchObject({ width: 1000, height: 1000 })
    await page.reload()
    await expect(page.getByRole('button', { name: 'Crop image', exact: true })).toHaveCount(0)
    await expect(
      page.getByRole('heading', { name: 'Crop image to a supported ratio', exact: true }),
    ).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Used in', exact: true })).toContainText(
      'Not used anywhere. It can be deleted.',
    )
    await expect(page.getByRole('link', { name: 'Download', exact: true })).toHaveAttribute(
      'href',
      `${baseURL}/api/media/${doc.id}/file`,
    )
    const download = page.waitForEvent('download', { timeout: 15_000 })
    const originalURL = page.url()
    await page.getByRole('link', { name: 'Download', exact: true }).click()
    const imageDownload = await download
    expect(imageDownload.suggestedFilename()).toBe(doc.filename)
    expect(await imageDownload.failure()).toBeNull()
    expect(await sharp(await readFile((await imageDownload.path())!)).metadata()).toMatchObject({
      width: 1000,
      height: 1000,
    })
    await expect(page).toHaveURL(originalURL)
    await page.getByRole('button', { name: /edit image/i }).click()
    await page.getByRole('spinbutton', { name: /focal point x/i }).fill('30')
    await page.getByRole('spinbutton', { name: /focal point y/i }).fill('70')
    await page.getByRole('button', { name: /apply changes/i }).click()
    const saved = page.waitForResponse(
      (r) =>
        r.request().method() === 'PATCH' && new URL(r.url()).pathname === `/api/media/${doc.id}`,
    )
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    expect((await saved).ok()).toBe(true)
    await expect
      .poll(
        async () => await (await page.request.get(`${baseURL}/api/media/${doc.id}?depth=0`)).json(),
      )
      .toMatchObject({ focalX: 30, focalY: 70 })
    const popup = page.waitForEvent('popup')
    await page.getByRole('link', { name: /open in new tab/i }).click()
    const original = await popup
    await original.waitForLoadState()
    expect((await original.request.get(original.url())).status()).toBe(200)
    await expect(original.locator('img')).toBeVisible()
    await expect(original).toHaveURL(`${baseURL}/api/media/${doc.id}/file`)
    await original.close()
    const blog = (
      await payload.find({
        collection: 'blogs',
        where: { slug: { equals: `e2e-blogs-${runID}-article` } },
        depth: 0,
      })
    ).docs[0]
    const previousImage = blog.heroImage
    try {
      await payload.update({
        collection: 'blogs',
        id: blog.id,
        data: { heroImage: doc.id },
        context: { disableRevalidate: true },
      })
      await page.reload()
      await expect(
        page
          .getByRole('region', { name: 'Used in', exact: true })
          .locator(`a[href="/admin/collections/blogs/${blog.id}"]`),
      ).toHaveAttribute('href', `/admin/collections/blogs/${blog.id}`)
      const blocked = await page.request.delete(`${baseURL}/api/media/${doc.id}`)
      expect(blocked.status()).toBe(400)
      expect(await blocked.text()).toContain('Remove it there first.')
    } finally {
      await payload.update({
        collection: 'blogs',
        id: blog.id,
        data: { heroImage: previousImage },
        context: { disableRevalidate: true },
      })
    }
  })

  test('supported uploads and saved images have no crop entry; native replacement crops unsupported files', async ({
    page,
  }) => {
    await page.goto(`${baseURL}/admin/collections/media/create`)
    const buffer = await sharp({
      create: { width: 1600, height: 1200, channels: 3, background: '#5f805a' },
    })
      .png()
      .toBuffer()
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: `${prefix}-supported.png`, mimeType: 'image/png', buffer })
    await expect(page.getByRole('textbox', { name: 'File Name', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Crop image', exact: true })).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.locator('input[name=alt]').fill('Green tea garden landscape')
    const doc = await save(page, 'media')
    expect(doc).toMatchObject({ width: 1600, height: 1200 })
    await page.reload()
    await expect(page.getByRole('button', { name: /edit image/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Crop image', exact: true })).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: doc.filename, exact: true }).click()
    await page.getByRole('button', { name: 'Replace file', exact: true }).click()
    const replacement = await sharp({
      create: { width: 1000, height: 210, channels: 3, background: '#5f805a' },
    })
      .png()
      .toBuffer()
    await page.locator('input[type=file]').setInputFiles({
      name: `${prefix}-replacement.png`,
      mimeType: 'image/png',
      buffer: replacement,
    })
    const dialog = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Crop image to a supported ratio', exact: true }),
    })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Result: 373 × 210 · 16:9')).toBeVisible()
    await dialog.getByRole('button', { name: 'Apply crop', exact: true }).click()
    const response = page.waitForResponse(
      (r) =>
        r.request().method() === 'PATCH' && new URL(r.url()).pathname === `/api/media/${doc.id}`,
    )
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    expect((await response).ok()).toBe(true)
    await expect
      .poll(async () => (await page.request.get(`${baseURL}/api/media/${doc.id}?depth=0`)).json())
      .toMatchObject({ width: 373, height: 210 })
    await expect(page.getByRole('button', { name: 'Crop image', exact: true })).toHaveCount(0)
  })

  test('uploads and previews PDF and all Office types with title prefill and native download', async ({
    page,
  }) => {
    for (const extension of ['pdf', 'docx', 'xlsx', 'pptx'] as const) {
      await page.goto(`${baseURL}/admin/collections/documents/create`)
      await page.locator('input[type=file]').setInputFiles({
        name: `${prefix}-${extension}.${extension}`,
        mimeType: extension === 'pdf' ? 'application/pdf' : officeTypes[extension].mime,
        buffer: extension === 'pdf' ? browserPDF() : zip(officeEntries(extension)),
      })
      await expect(page.locator('input[name=title]')).toHaveValue(`${prefix}-${extension}`)
      const doc = await save(page, 'documents')
      await expect(page.getByRole('region', { name: 'Used in', exact: true })).toContainText(
        'Not used anywhere. It can be deleted.',
      )
      if (extension === 'pdf') {
        const iframe = page.locator('iframe')
        await expect(iframe).toBeVisible()
        const source = await iframe.getAttribute('src')
        expect(source).toBeTruthy()
        const previewURL = new URL(source!, baseURL)
        const documentURL = new URL(doc.url, baseURL)
        expect(previewURL.origin).toBe(documentURL.origin)
        expect(previewURL.pathname).toBe(documentURL.pathname)
        const preview = await page.request.get(previewURL.href)
        expect(preview.status()).toBe(200)
        expect(preview.headers()['content-type']).toBe('application/pdf')
        expect(await preview.body()).toEqual(browserPDF())
      } else await expect(page.getByRole('link', { name: 'Download', exact: true })).toBeVisible()
      const download = page.waitForEvent('download', { timeout: 15_000 })
      const originalURL = page.url()
      await page.getByRole('link', { name: 'Download', exact: true }).click()
      const documentDownload = await download
      expect(documentDownload.suggestedFilename()).toBe(doc.filename)
      expect(await documentDownload.failure()).toBeNull()
      expect(await readFile((await documentDownload.path())!)).toEqual(
        extension === 'pdf' ? browserPDF() : zip(officeEntries(extension)),
      )
      await expect(page).toHaveURL(originalURL)
    }
  })

  test('prefills both batch forms independently and preserves edited text', async ({ page }) => {
    for (const collection of ['media', 'documents'] as const) {
      await page.goto(`${baseURL}/admin/collections/${collection}`)
      const access = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === `/api/${collection}/access` &&
          response.request().postData()?.includes('published') === true,
      )
      await page.getByRole('button', { name: 'Bulk Upload', exact: true }).click()
      const permissions = await access
      expect(permissions.ok()).toBe(true)
      expect(await permissions.json()).toMatchObject({ create: true })
      await page.waitForLoadState('networkidle')
      const extension = collection === 'media' ? 'png' : 'pdf'
      const buffer =
        collection === 'media'
          ? await sharp({
              create: { width: 1200, height: 900, channels: 3, background: '#61805c' },
            })
              .png()
              .toBuffer()
          : browserPDF()
      const names = [1, 2].map((index) => `${prefix}-batch-${collection}-${index}`)
      await page.locator('input[type=file][multiple]').setInputFiles(
        names.map((name) => ({
          name: `${name}.${extension}`,
          mimeType: collection === 'media' ? 'image/png' : 'application/pdf',
          buffer,
        })),
      )
      const field = page.locator(`input[name=${collection === 'media' ? 'alt' : 'title'}]`)
      await expect(field).toHaveValue(names[0])
      // Exercise the native row selection after permissions initialize.
      await page.getByRole('button', { name: new RegExp(`${names[1]}[.]${extension}`) }).click()
      await expect(field).toHaveValue(names[1])
      await page.getByRole('button', { name: new RegExp(`${names[0]}[.]${extension}`) }).click()
      await expect(field).toHaveValue(names[0])
      await expect(field).toBeEnabled()
      await field.fill('A carefully edited tea resource')
      await page.getByRole('button', { name: new RegExp(`${names[1]}[.]${extension}`) }).click()
      await expect(field).toHaveValue(names[1])
      await page.getByRole('button', { name: new RegExp(`${names[0]}[.]${extension}`) }).click()
      await expect(field).toHaveValue('A carefully edited tea resource')
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await expect
        .poll(
          async () =>
            (
              await payload.count({
                collection,
                where: { filename: { contains: `${prefix}-batch-${collection}` } },
              })
            ).totalDocs,
        )
        .toBe(2)
      const saved = await payload.find({
        collection,
        depth: 0,
        where: { filename: { in: names.map((name) => `${name}.${extension}`) } },
      })
      expect(saved.totalDocs).toBe(2)
      for (const [index, name] of names.entries()) {
        const record = saved.docs.find((doc) => doc.filename === `${name}.${extension}`)
        expect(record).toBeDefined()
        expect(
          record && ('alt' in record ? record.alt : 'title' in record ? record.title : undefined),
        ).toBe(index === 0 ? 'A carefully edited tea resource' : name)
      }
      await expect(page.getByRole('dialog', { name: 'Bulk Upload', exact: true })).toHaveCount(0)
    }
  })

  test('moves both resources through the native shared-folder picker and unfiles them after parent deletion', async ({
    page,
  }) => {
    const parent = await payload.create({
      collection: 'folders',
      data: { name: `${prefix} archive` },
    })
    const child = await payload.create({
      collection: 'folders',
      data: { name: `${prefix} child`, _h_folders: parent.id },
    })
    const resources: Array<{ collection: 'media' | 'documents'; id: string }> = []
    for (const collection of ['media', 'documents'] as const) {
      await page.goto(`${baseURL}/admin/collections/${collection}/create`)
      const isImage = collection === 'media'
      const buffer = isImage
        ? await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#61805c' } })
            .png()
            .toBuffer()
        : browserPDF()
      await page.locator('input[type=file]').setInputFiles({
        name: `${prefix}-folder-${collection}.${isImage ? 'png' : 'pdf'}`,
        mimeType: isImage ? 'image/png' : 'application/pdf',
        buffer,
      })
      await page.locator(`input[name=${isImage ? 'alt' : 'title'}]`).fill('Tea archive resource')
      const doc = await save(page, collection)
      resources.push({ collection, id: doc.id })
      await page.getByRole('button', { name: 'None', exact: true }).click()
      await page.getByRole('button', { name: `${prefix} archive`, exact: true }).click()
      await page
        .getByRole('button', { name: `${prefix} child`, exact: true })
        .getByRole('checkbox')
        .check()
      await page.getByRole('button', { name: 'Select', exact: true }).click()
      const moved = page.waitForResponse(
        (r) =>
          r.request().method() === 'PATCH' &&
          new URL(r.url()).pathname === `/api/${collection}/${doc.id}`,
      )
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      expect((await moved).ok()).toBe(true)
      await expect(page.getByRole('button', { name: `${prefix} child`, exact: true })).toBeVisible()
      expect((await payload.findByID({ collection, id: doc.id, depth: 0 }))._h_folders).toBe(
        child.id,
      )
    }
    await page.goto(`${baseURL}/admin/collections/folders/${parent.id}`)
    await page.getByRole('button', { name: 'More options', exact: true }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    const deleted = page.waitForResponse(
      (r) =>
        r.request().method() === 'DELETE' &&
        new URL(r.url()).pathname === `/api/folders/${parent.id}`,
    )
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    expect((await deleted).ok()).toBe(true)
    expect(
      (await payload.find({ collection: 'folders', where: { id: { in: [parent.id, child.id] } } }))
        .totalDocs,
    ).toBe(0)
    for (const { collection, id } of resources) {
      expect((await payload.findByID({ collection, id, depth: 0 }))._h_folders ?? null).toBeNull()
      await page.goto(`${baseURL}/admin/collections/${collection}/${id}`)
      await expect(page.getByRole('button', { name: 'None', exact: true })).toBeVisible()
    }
  })

  test('shows readable list columns and the redesigned Used in states for both resources', async ({
    page,
  }) => {
    const png = await sharp({
      create: { width: 800, height: 600, channels: 3, background: '#52775f' },
    })
      .png()
      .toBuffer()
    for (const collection of ['media', 'documents'] as const) {
      const filename = `${prefix}-list-${collection}.${collection === 'media' ? 'png' : 'pdf'}`
      const upload = await page.request.post(`${baseURL}/api/${collection}`, {
        multipart: {
          file: {
            name: filename,
            mimeType: collection === 'media' ? 'image/png' : 'application/pdf',
            buffer: collection === 'media' ? png : browserPDF(),
          },
          _payload: JSON.stringify(
            collection === 'media'
              ? { alt: 'Tea garden in morning light' }
              : { title: 'Organic tea certification' },
          ),
        },
      })
      expect(upload.ok(), await upload.text()).toBe(true)
      const resource = (await upload.json()).doc
      await page.goto(`${baseURL}/admin/collections/${collection}`)
      for (const header of collection === 'media'
        ? ['Name', 'Alt text', 'Type', 'Dimensions', 'Size', 'Folder', 'Updated At']
        : ['Title', 'File name', 'Type', 'Size', 'Folder', 'Updated At']) {
        await expect(
          page.getByRole('columnheader').filter({ has: page.getByText(header, { exact: true }) }),
        ).toBeVisible()
      }
      const row = page.getByRole('row').filter({
        hasText:
          collection === 'media' ? 'Tea garden in morning light' : 'Organic tea certification',
      })
      await expect(row).toContainText(collection === 'media' ? 'PNG' : 'PDF')
      await expect(row.getByRole('button', { name: 'None', exact: true })).toBeVisible()
      await expect(row.getByText(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/)).toBeVisible()
      await expect(row).toContainText(
        collection === 'media' ? filename.replace(/\.png$/, '') : filename,
      )
      // The resource just uploaded is first with the collection's default sorting.
      await expect(page.locator('tbody tr').first()).toContainText(
        collection === 'media' ? 'Tea garden in morning light' : 'Organic tea certification',
      )
      await page.goto(`${baseURL}/admin/collections/${collection}/${resource.id}`)
      await expect(page.locator('input[name=updatedAt]')).toHaveCount(0)
      const panel = page.getByRole('region', { name: 'Used in', exact: true })
      await expect(panel).toContainText('Not used anywhere. It can be deleted.')
      await expect(panel).not.toContainText('older versions')
      await expect(
        page.getByText(
          collection === 'media'
            ? 'Describe the image for screen readers and search engines.'
            : 'Shown to editors when choosing this document.',
          { exact: true },
        ),
      ).toBeVisible()
      if (collection === 'documents')
        await expect(page.getByText('Optional short summary.', { exact: true })).toBeVisible()
      let attempts = 0
      await page.route(`**/api/${collection}/${resource.id}/references`, async (route) => {
        attempts++
        if (attempts === 1) return route.fulfill({ status: 503, json: {} })
        const owners = Array.from({ length: 8 }, (_, index) => ({
          ownerType: index === 7 ? 'global' : 'collection',
          ownerSlug: index === 7 ? 'header' : 'blogs',
          documentID: `blog-${index}`,
          ownerDocumentID: `blog-${index}`,
          title: index === 7 ? 'Header' : `Tea story ${index + 1}`,
          path: 'heroImage',
          editURL: index === 7 ? '/admin/globals/header' : `/admin/collections/blogs/blog-${index}`,
        }))
        await route.fulfill({
          json: {
            current: [...owners, { ...owners[0], path: 'layout.0.image' }],
            historicalCount: 4,
          },
        })
      })
      await page.reload()
      await expect(panel).toContainText("Couldn't load where this is used.")
      await panel.getByRole('button', { name: 'Try again', exact: true }).click()
      await expect(panel.getByRole('link')).toHaveCount(5)
      await expect(panel).toContainText("Also in 4 older versions — these don't block deletion.")
      await expect(panel).not.toContainText('heroImage')
      await panel.getByRole('button', { name: 'Show all 8', exact: true }).click()
      await expect(panel.getByRole('link')).toHaveCount(8)
      const heading = await panel.getByText('Used in', { exact: true }).boundingBox()
      const count = await panel.getByText('8', { exact: true }).boundingBox()
      expect(heading).not.toBeNull()
      expect(count).not.toBeNull()
      expect(count!.x - (heading!.x + heading!.width)).toBeLessThan(20)
      await panel.screenshot({ path: test.info().outputPath(`${collection}-used-in.png`) })
      await expect(panel).toContainText('Global')
      await expect(panel.getByRole('link', { name: 'Header', exact: true })).toHaveAttribute(
        'href',
        '/admin/globals/header',
      )
      await page.setViewportSize({ width: 390, height: 844 })
      await expect(panel).toBeVisible()
      const bounds = await panel.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391)
      await page.setViewportSize({ width: 1280, height: 720 })
    }
  })

  test('rejects an unsupported video ratio in the browser without offering image crop', async ({
    page,
  }) => {
    await page.goto(`${baseURL}/admin/collections/media/create`)
    const mp4 = createFile()
    mp4.addTrack({ width: 1600, height: 1200, duration: 1000, timescale: 1000 })
    await page.locator('input[type=file]').setInputFiles({
      name: `${prefix}-video.mp4`,
      mimeType: 'video/mp4',
      buffer: Buffer.from(mp4.getBuffer().buffer),
    })
    await page.locator('input[name=alt]').fill('Tea garden overview')
    await expect(page.getByRole('dialog', { name: 'Crop image' })).toHaveCount(0)
    const rejected = page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/media',
    )
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    const response = await rejected
    expect(response.status()).toBe(400)
    expect(await response.text()).toContain('Use 16:9, 9:16, 1:1 or 4:5.')
    await expect(
      page.getByText('Video ratio not supported (1600 × 1200). Use 16:9, 9:16, 1:1 or 4:5.', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/media\/create/)
  })
})
