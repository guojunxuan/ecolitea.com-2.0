import { expect, type Page, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'

import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'
import { login } from '../helpers/login'

test.describe.serial('Site Settings Social admin', () => {
  test.setTimeout(120_000)

  const missingIconPlatformName = `E2E Missing Icon ${randomUUID()}`
  let page: Page

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
    const context = await browser.newContext()
    page = await context.newPage()
    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
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

  test('keeps valid Social Link row actions and hides copy and duplicate actions', async () => {
    await openSocialTab()
    await page.getByRole('button', { name: 'Add Social Link' }).click()
    await page.getByRole('button', { name: 'Add Social Link' }).click()
    const socialLinkRow = page.locator('#socialLinks-row-0')
    await expect(socialLinkRow).toBeVisible()
    await socialLinkRow.getByRole('button', { name: 'More options' }).click()

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
