import type { CallToActionBlock as Props } from '@/payload-types'
import RichText from '@/components/RichText'
import { CMSLink } from '@/components/Link'
import { Media } from '@/components/Media'
import { MEDIA_PRESENTATION } from '@/components/Media/config'
import { cn } from '@/utilities/ui'
import styles from './Component.module.css'

export const CallToActionBlock = ({
  heading,
  description,
  media,
  links,
  theme = 'default',
}: Props) => (
  <div className={styles.container} data-website-theme={theme || 'default'}>
    <div className={cn(styles.panel, media && styles.withMedia)}>
      {media && (
        <Media className={styles.media} resource={media} presentation={MEDIA_PRESENTATION.body} />
      )}
      <div className={styles.content}>
        <h2 className={styles.heading}>{heading}</h2>
        {description && (
          <RichText className={styles.richText} data={description} enableGutter={false} />
        )}
        {Boolean(links?.length) && (
          <div className={styles.links}>
            {links?.map(({ id, link }, index) => (
              <CMSLink key={id || index} size="lg" {...link} />
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
)
