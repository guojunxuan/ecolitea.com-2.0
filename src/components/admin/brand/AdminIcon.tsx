import Image from 'next/image'
import { getAdminBrand } from './getAdminBrand'
import styles from './AdminBrand.module.css'

export async function AdminIcon() {
  const { icon, name } = await getAdminBrand()

  return icon ? (
    <Image src={icon.url} alt={name} width={24} height={24} className={styles.icon} unoptimized />
  ) : (
    <span className={styles.initial} aria-label={name} role="img">
      {Array.from(name)[0]?.toLocaleUpperCase('en')}
    </span>
  )
}
