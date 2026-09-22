import type { ButtonProps } from '@/components/ui/button'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/utilities/ui'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import * as React from 'react'

import styles from './pagination.module.css'

const Pagination = ({ className, ...props }: React.ComponentProps<'nav'>) => (
  <nav
    aria-label="pagination"
    className={cn(styles.pagination, className)}
    role="navigation"
    {...props}
  />
)

const PaginationContent: React.FC<
  { ref?: React.Ref<HTMLUListElement> } & React.HTMLAttributes<HTMLUListElement>
> = ({ className, ref, ...props }) => (
  <ul className={cn(styles.content, className)} ref={ref} {...props} />
)

const PaginationItem: React.FC<
  { ref?: React.Ref<HTMLLIElement> } & React.HTMLAttributes<HTMLLIElement>
> = ({ className, ref, ...props }) => (
  <li className={cn(styles.item, className)} ref={ref} {...props} />
)

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<ButtonProps, 'size'> &
  React.ComponentProps<'button'>

const PaginationLink = ({ className, isActive, size = 'icon', ...props }: PaginationLinkProps) => (
  <button
    aria-current={isActive ? 'page' : undefined}
    className={cn(
      buttonVariants({
        size,
        variant: isActive ? 'outline' : 'ghost',
      }),
      className,
    )}
    {...props}
  />
)

const PaginationPrevious = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to previous page"
    className={cn(styles.previous, className)}
    size="default"
    {...props}
  >
    <ChevronLeft className={styles.icon} />
    <span>Previous</span>
  </PaginationLink>
)

const PaginationNext = ({ className, ...props }: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to next page"
    className={cn(styles.next, className)}
    size="default"
    {...props}
  >
    <span>Next</span>
    <ChevronRight className={styles.icon} />
  </PaginationLink>
)

const PaginationEllipsis = ({ className, ...props }: React.ComponentProps<'span'>) => (
  <span aria-hidden className={cn(styles.ellipsis, className)} {...props}>
    <MoreHorizontal className={styles.icon} />
    <span className={styles.screenReaderOnly}>More pages</span>
  </span>
)

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}
