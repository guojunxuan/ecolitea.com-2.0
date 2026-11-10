'use client'
import { useFormFields } from '@payloadcms/ui'

export const CategoryCarouselStatus = () => {
  const hidden = useFormFields(
    ([fields]) => fields['product.categoryCarousel.enabled']?.value === false,
  )
  return hidden ? (
    <p role="status">
      Carousel is hidden on the site. Saved items are retained and can still be edited.
    </p>
  ) : null
}
