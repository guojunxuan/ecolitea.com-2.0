import { Mail, MapPin, Phone } from 'lucide-react'
import React from 'react'

import styles from './index.module.css'
import type { ContactData } from './types'

type Props = {
  contact: ContactData
}

export const ContactList = ({ contact }: Props) => (
  <address className={styles.information} data-footer-content="contact">
    <ul className={styles.contactList}>
      {contact.address && (
        <li className={styles.contactItem}>
          <MapPin aria-hidden="true" className={styles.contactIcon} />
          <span>{contact.address}</span>
        </li>
      )}
      {contact.phone && (
        <li className={styles.contactItem}>
          <Phone aria-hidden="true" className={styles.contactIcon} />
          <a href={`tel:${contact.phone}`}>{contact.phone}</a>
        </li>
      )}
      {contact.salesEmail && (
        <li className={styles.contactItem}>
          <Mail aria-hidden="true" className={styles.contactIcon} />
          <a href={`mailto:${contact.salesEmail}`}>{contact.salesEmail}</a>
        </li>
      )}
    </ul>
  </address>
)
