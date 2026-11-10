import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { ProductSpecificationGroup } from '@/utilities/products/models'

import styles from './index.module.css'

const initialRows = 6

export function ProductSpecifications({ groups }: { groups: ProductSpecificationGroup[] }) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const rowCount = groups.reduce((count, { items }) => count + items.length, 0)
  let remaining = expanded ? rowCount : initialRows
  const visibleGroups: ProductSpecificationGroup[] = []
  for (const { group, items } of groups) {
    if (remaining <= 0) break
    visibleGroups.push({ group, items: items.slice(0, remaining) })
    remaining -= items.length
  }

  return (
    <>
      <div id={listId}>
        {visibleGroups.map(({ group, items }, groupIndex) => (
          <div key={groupIndex} className={styles.group}>
            {group && <h2 className={styles.groupTitle}>{group}</h2>}
            <dl className={styles.list}>
              {items.map(({ label, value }, index) => (
                <div key={index} className={styles.row}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      {rowCount > initialRows && (
        <Button
          type="button"
          variant="link"
          size="clear"
          className={styles.toggle}
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={listId}
        >
          {expanded ? 'Show fewer specifications' : 'Show all specifications'}
        </Button>
      )}
    </>
  )
}
