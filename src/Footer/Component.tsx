import { getCachedFooter, getCachedSiteSettings } from '@/utilities/getGlobals'
import Link from 'next/link'
import React from 'react'

import { Logo } from '@/components/Logo/Logo'
import { adaptFooter } from './adaptFooter'
import { ContactList } from './ContactList'
import styles from './index.module.css'
import { FooterNavigation } from './Navigation.client'

export async function Footer() {
  const [footerGlobal, siteSettings] = await Promise.all([
    getCachedFooter(),
    getCachedSiteSettings(),
  ])
  const footer = adaptFooter(footerGlobal, siteSettings)

  return (
    <footer className={`${styles.footer} mt-auto bg-black text-white`}>
      <div className="site-container">
        <div className={styles.primaryGrid}>
          <section aria-label="Brand" className={styles.brand} data-footer-content="brand">
            {footer.logo && (
              <Link className={styles.brandLink} href="/">
                <Logo image={footer.logo} className={styles.logo} />
              </Link>
            )}
            {footer.siteDescription && (
              <p className={styles.description}>{footer.siteDescription}</p>
            )}
            {footer.socialLinks.length > 0 && (
              <ul
                aria-label="Social media"
                className={styles.socialList}
                data-footer-content="social"
              >
                {footer.socialLinks.map((social) => (
                  <li key={social.id}>
                    <a
                      aria-label={social.platform}
                      className={styles.socialLink}
                      href={social.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt=""
                        className={styles.socialIcon}
                        height={social.icon.height}
                        src={social.icon.src}
                        width={social.icon.width}
                      />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <FooterNavigation columns={footer.columns} />

          <div className={styles.engagement}>
            {footer.newsletter && (
              <section
                aria-label="Newsletter"
                className={styles.newsletter}
                data-footer-content="newsletter"
              >
                <h2 className={styles.newsletterHeading}>{footer.newsletter.heading}</h2>
                <p className={styles.newsletterDescription}>{footer.newsletter.description}</p>
                <div className={styles.newsletterControls}>
                  <input
                    aria-label={footer.newsletter.emailPlaceholder}
                    className={styles.newsletterInput}
                    disabled
                    placeholder={footer.newsletter.emailPlaceholder}
                    type="email"
                  />
                  <button className={styles.newsletterButton} disabled type="button">
                    {footer.newsletter.buttonLabel}
                  </button>
                </div>
              </section>
            )}

            <ContactList contact={footer.contact} />
          </div>
        </div>

        <div className={styles.bottomBar}>
          <p>{footer.copyrightText}</p>
          {footer.legalLinks.length > 0 && (
            <nav aria-label="Legal">
              <ul className={styles.legalList}>
                {footer.legalLinks.map((link) => (
                  <li key={`${link.href}-${link.label}`}>
                    <Link
                      href={link.href}
                      {...(link.newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </div>
    </footer>
  )
}
