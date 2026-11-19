import Image from 'next/image'
import { getAdminBrand } from './getAdminBrand'
import styles from './AdminBrand.module.css'

export async function AdminLogo() {
  const { logo, name } = await getAdminBrand()

  return logo ? (
    <Image {...logo} alt={logo.alt || name} className={styles.logo} unoptimized priority />
  ) : (
    <span className={styles.wordmark}>{name}</span>
  )
}
