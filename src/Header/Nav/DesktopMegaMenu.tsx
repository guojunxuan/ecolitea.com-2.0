import Link from 'next/link'
import React from 'react'

import RichText from '@/components/RichText'

import type { HeaderDropdownData, HeaderLinkData } from './types'
import styles from './index.module.css'

const NavigationLink: React.FC<{ className?: string; link: HeaderLinkData }> = ({
  className,
  link,
}) => (
  <Link
    className={className}
    href={link.href}
    {...(link.newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
  >
    {link.label}
  </Link>
)

type DesktopMegaMenuProps = {
  dropdown: HeaderDropdownData
  id: string
  label: string
}

export const DesktopMegaMenu: React.FC<DesktopMegaMenuProps> = ({ dropdown, id, label }) => (
  <section aria-label={`${label} menu`} className={styles.megaMenu} id={id} role="region">
    <div className={`site-container ${styles.megaMenuInner}`}>
      {(dropdown.description || dropdown.descriptionLinks.length > 0) && (
        <div className={styles.megaMenuIntroduction}>
          {dropdown.description && <p>{dropdown.description}</p>}
          {dropdown.descriptionLinks.map(({ id: linkID, link }) => (
            <NavigationLink className={styles.descriptionLink} key={linkID} link={link} />
          ))}
        </div>
      )}

      <div className={styles.megaMenuItems}>
        {dropdown.items.map((item) => {
          if (item.type === 'default') {
            return (
              <div className={styles.defaultItem} key={item.id}>
                <NavigationLink link={item.defaultItem.link} />
                {item.defaultItem.description && <p>{item.defaultItem.description}</p>}
              </div>
            )
          }

          const content = item.type === 'featured' ? item.featuredItem : item.listItem

          return (
            <div className={styles.groupedItem} key={item.id}>
              <div className={styles.groupedItemHeading}>
                <span>{content.tag}</span>
                <NavigationLink link={content.landingLink} />
              </div>
              {item.type === 'featured' && item.featuredItem.label && (
                <RichText
                  className={styles.featuredCopy}
                  data={item.featuredItem.label}
                  enableGutter={false}
                  enableProse={false}
                />
              )}
              <div className={styles.groupedLinks}>
                {content.links.map(({ id: linkID, link }) => (
                  <NavigationLink key={linkID} link={link} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  </section>
)
