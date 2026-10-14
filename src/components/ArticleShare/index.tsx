import type { ArticleShareModel } from '@/utilities/blogs/articleShare'
import { CopyLink } from './CopyLink'
import styles from './index.module.css'

export const ArticleShare = ({
  model,
  url,
  title = 'Share',
}: {
  model: ArticleShareModel
  url: string
  title?: string
}) => {
  if (!model.links.length && !model.copyLink) return null
  return (
    <section aria-label={title} className={styles.share}>
      <p className={styles.label}>{title}</p>
      <div className={styles.links}>
        {model.links.map(({ name, href, icon }) => (
          <a
            aria-label={`Share on ${name}`}
            className={styles.control}
            href={href}
            key={name}
            {...(new URL(href).protocol === 'mailto:'
              ? {}
              : { target: '_blank', rel: 'noopener noreferrer' })}
          >
            {/* Uploaded SVGs retain their original colors, as in the Footer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={icon.src} alt="" width={20} height={20} />
          </a>
        ))}
        {model.copyLink && <CopyLink url={url} />}
      </div>
    </section>
  )
}
