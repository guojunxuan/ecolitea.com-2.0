import { getCachedSettings } from '@/utilities/getGlobals'

import { resolveProductInquiry } from './inquiry'
import type { InquiryButton } from './models'

export const getDefaultInquiryButtons = async (): Promise<InquiryButton[]> => {
  const settings = await getCachedSettings()
  return resolveProductInquiry({ inquiry: { mode: 'default' } }, settings).buttons
}
