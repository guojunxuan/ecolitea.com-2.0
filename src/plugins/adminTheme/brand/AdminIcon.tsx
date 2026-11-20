import Image from 'next/image'
import { getAdminBrand } from './getAdminBrand'
import styles from './AdminBrand.module.css'

export async function AdminIcon({ showName = false }: { showName?: boolean }) {
  const { icon, name } = await getAdminBrand()
  const graphic = icon ? (
    <Image src={icon.url} alt={showName ? '' : name} width={24} height={24} className={styles.icon} unoptimized />
  ) : (
    <span className={styles.initial} aria-label={showName ? undefined : name} aria-hidden={showName} role="img">
      {Array.from(name)[0]?.toLocaleUpperCase('en')}
    </span>
  )

  return showName ? <div className={styles.navBrand}>{graphic}<span>{name}</span></div> : graphic
}
