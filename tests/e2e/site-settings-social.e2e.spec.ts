import { expect, type Page, test } from '@playwright/test'
import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import { randomUUID } from 'node:crypto'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'
import { login } from '../helpers/login'

test.describe.serial('Site Settings Social admin', () => {
  test.setTimeout(120_000)

  const missingIconPlatformName = `E2E Missing Icon ${randomUUID()}`
  const relationshipPlatformName = `E2E Relationship ${randomUUID()}`
  const svgFilename = `social-platform-e2e-${randomUUID()}.svg`
  let page: Page
  let payload: Payload

  const openSocialTab = async () => {
    await page.goto('http://localhost:3000/admin/globals/site-settings')
    const lockDialog = page.getByRole('dialog', { name: 'document-locked' })
    if (await lockDialog.isVisible()) {
      await lockDialog.getByRole('button', { name: 'Take over' }).click()
    }
    await page.getByRole('tab', { name: 'Social' }).click()
    await expect(page.getByRole('button', { name: 'Create Social Platform' }).first()).toBeVisible()
  }

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()
    payload = await getPayload({ config })
    await (payload.db as MongooseAdapter).collections['brand-assets'].create({
      alt: 'Social Platform E2E icon',
      filename: svgFilename,
      filesize: 70,
      height: 1,
      mimeType: 'image/svg+xml',
      width: 1,
    })

    const context = await browser.newContext()
    page = await context.newPage()
    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    if (payload) {
      await payload.delete({
        collection: 'social-platforms',
        where: { platform: { equals: relationshipPlatformName } },
      })
      await (payload.db as MongooseAdapter).collections['brand-assets'].deleteMany({
        filename: svgFilename,
      })
    }
    await cleanupTestUser()
  })

  test('keeps the native create Drawer and draft open after a missing Icon save', async () => {
    await openSocialTab()
    await page.getByRole('button', { name: 'Create Social Platform' }).first().click()

    const drawer = page.getByRole('dialog', { name: 'site-settings-social-platform' })
    await expect(drawer).toBeVisible()
    await expect(drawer).toContainText('Creating new Social Platform')
    await drawer.locator('input[name="platform"]').fill(missingIconPlatformName)
    await expect(drawer.locator('#field-icon')).toBeVisible()
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(drawer).toBeVisible()
    await expect(drawer.locator('input[name="platform"]')).toHaveValue(missingIconPlatformName)
    await expect(page.getByText('The following field is invalid: Icon')).toBeVisible()
    await expect(page.getByText('Social platform created.', { exact: true })).toHaveCount(0)

    await drawer.getByRole('button', { name: 'Close' }).first().click()
    await expect(drawer).toBeHidden()
  })

  test('selects and relabels a relationship after creating a Platform', async () => {
    await openSocialTab()
    const row = page.locator('#socialLinks-row-0')
    await row.getByRole('button', { name: 'Create Social Platform' }).click()

    const drawer = page.getByRole('dialog', {
      name: 'site-settings-social-platform-socialLinks-0-platform',
    })
    await expect(drawer).toBeVisible()
    await drawer.locator('input[name="platform"]').fill(relationshipPlatformName)
    await drawer.getByRole('button', { name: 'Choose from existing' }).click()

    const assetPicker = page.getByRole('dialog', { name: /^list-drawer_/ })
    await expect(assetPicker).toBeVisible()
    await expect(drawer).toBeVisible()
    await assetPicker.getByRole('button').filter({ hasText: svgFilename }).click()
    await expect(assetPicker).toBeHidden()
    await expect(drawer).toBeVisible()

    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(drawer).toBeHidden()
    await expect(
      row.getByRole('button', { name: `Edit ${relationshipPlatformName}` }),
    ).toBeVisible()
    await expect(row.getByText(relationshipPlatformName, { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Social platform created.', { exact: true })).toHaveCount(0)
  })

  test('keeps valid Social Link row actions and hides copy and duplicate actions', async () => {
    await openSocialTab()
    await page.locator('#socialLinks-row-0').getByRole('button', { name: 'More options' }).click()

    const actions = page.locator('.popup__content.site-settings-social-links-actions')
    await expect(actions).toBeVisible()
    await expect(actions.getByText('Add Below', { exact: true })).toBeVisible()
    await expect(actions.getByText('Move Down', { exact: true })).toBeVisible()
    await expect(actions.getByText('Remove', { exact: true })).toBeVisible()
    await expect(actions.locator('.array-actions__duplicate')).toBeHidden()
    await expect(actions.locator('.array-actions__copy')).toBeHidden()
    await expect(actions.locator('.array-actions__paste-below')).toBeHidden()
    await expect(actions.locator('.array-actions__paste')).toBeHidden()
    await expect(
      page.locator('.site-settings-social-links .array-field__header-action'),
    ).toBeHidden()
  })
})
