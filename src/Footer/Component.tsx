import { getCachedGlobal } from '@/utilities/getGlobals'
import Link from 'next/link'
import React from 'react'

import { Logo } from '@/components/Logo/Logo'
import { adaptFooter } from './adaptFooter'
import styles from './index.module.css'
import { FooterNavigation } from './Navigation.client'

const newsletter = {
  heading: 'Stay informed',
  description: 'Product updates and practical insights.',
  placeholder: 'Email address',
  buttonLabel: 'Subscribe',
} as const

export async function Footer() {
  const [footerGlobal, siteSettings] = await Promise.all([
    getCachedGlobal('footer', 1)(),
    getCachedGlobal('site-settings', 1)(),
  ])
  const footer = adaptFooter(footerGlobal, siteSettings)

  return (
    <footer className={`${styles.footer} mt-auto bg-black text-white`}>
      <div className="site-container">
        <div className={styles.primaryGrid}>
          <section aria-label="Brand" className={styles.brand}>
            {footer.logo && (
              <Link className={styles.brandLink} href="/">
                <Logo image={footer.logo} className="h-7 sm:h-8 lg:h-10" />
              </Link>
            )}
            <h2 className={styles.brandName}>{footer.siteName}</h2>
            {footer.siteDescription && (
              <p className={styles.description}>{footer.siteDescription}</p>
            )}
          </section>

          <FooterNavigation columns={footer.columns} />

          <section aria-labelledby="footer-newsletter-heading" className={styles.newsletter}>
            <h2 className={styles.newsletterHeading} id="footer-newsletter-heading">
              {newsletter.heading}
            </h2>
            <p className={styles.newsletterDescription}>{newsletter.description}</p>
            <div className={styles.newsletterControls}>
              <input
                aria-label={newsletter.placeholder}
                className={styles.newsletterInput}
                disabled
                placeholder={newsletter.placeholder}
                type="email"
              />
              <button className={styles.newsletterButton} disabled type="button">
                {newsletter.buttonLabel}
              </button>
            </div>
          </section>
        </div>

        <address className={styles.information}>
          <div>
            {footer.contact.address && <p>{footer.contact.address}</p>}
            {footer.contact.businessHours && <p>{footer.contact.businessHours}</p>}
          </div>
          <ul className={styles.contactList}>
            {footer.contact.salesEmail && (
              <li>
                <a href={`mailto:${footer.contact.salesEmail}`}>{footer.contact.salesEmail}</a>
              </li>
            )}
            {footer.contact.phone && (
              <li>
                <a href={`tel:${footer.contact.phone}`}>{footer.contact.phone}</a>
              </li>
            )}
            {footer.contact.whatsapp && (
              <li>
                <a href={`https://wa.me/${footer.contact.whatsapp.replace(/\D/g, '')}`}>
                  WhatsApp: {footer.contact.whatsapp}
                </a>
              </li>
            )}
          </ul>
          {footer.socialLinks.length > 0 && (
            <ul aria-label="Social media" className={styles.socialList}>
              {footer.socialLinks.map((social) => (
                <li key={social.id}>
                  <a
                    className={styles.socialLink}
                    href={social.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {social.icon && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt=""
                        className={styles.socialIcon}
                        height={social.icon.height}
                        src={social.icon.src}
                        width={social.icon.width}
                      />
                    )}
                    <span>{social.platform}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </address>

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
