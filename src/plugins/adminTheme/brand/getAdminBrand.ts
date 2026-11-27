import { getCachedGlobal } from '@/utilities/getGlobals'
import { resolveAdminBrand } from './resolveAdminBrand'

export async function getAdminBrand() {
  return resolveAdminBrand(await getCachedGlobal('site-settings', 1)())
}
