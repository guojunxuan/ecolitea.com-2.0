'use client'
import {
  Pagination as PaginationComponent,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { cn } from '@/utilities/ui'
import { buttonVariants } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React from 'react'

import styles from './index.module.css'

export const Pagination: React.FC<{
  className?: string
  page: number
  totalPages: number
  routeBase?: string
  firstPageHref?: string
  linkMode?: boolean
}> = (props) => {
  const router = useRouter()

  const {
    className,
    page,
    totalPages,
    routeBase = '/posts',
    firstPageHref,
    linkMode = false,
  } = props
  const pageHref = (pageNumber: number) =>
    pageNumber === 1 && firstPageHref
      ? firstPageHref
      : `${routeBase.replace(/\/$/, '')}/page/${pageNumber}`
  const hasNextPage = page < totalPages
  const hasPrevPage = page > 1

  const hasExtraPrevPages = page - 1 > 1
  const hasExtraNextPages = page + 1 < totalPages
  const linkedPage = (
    pageNumber: number,
    label: React.ReactNode,
    ariaLabel?: string,
    active = false,
  ) => (
    <Link
      href={pageHref(pageNumber)}
      aria-label={ariaLabel}
      aria-current={active ? 'page' : undefined}
      className={buttonVariants({
        size: ariaLabel ? 'default' : 'icon',
        variant: active ? 'outline' : 'ghost',
      })}
    >
      {label}
    </Link>
  )

  if (linkMode) {
    // Always expose the first and last pages so crawlers and readers can jump to either end.
    const pages = [...new Set([1, page - 1, page, page + 1, totalPages])]
      .filter((pageNumber) => pageNumber >= 1 && pageNumber <= totalPages)
      .sort((a, b) => a - b)

    return (
      <div className={cn(styles.pagination, className)}>
        <PaginationComponent>
          <PaginationContent>
            {hasPrevPage && (
              <PaginationItem>
                {linkedPage(
                  page - 1,
                  <>
                    <ChevronLeft size={16} /> Previous
                  </>,
                  'Go to previous page',
                )}
              </PaginationItem>
            )}
            {pages.map((pageNumber, index) => (
              <React.Fragment key={pageNumber}>
                {index > 0 && pageNumber - pages[index - 1]! > 1 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
                <PaginationItem>
                  {linkedPage(pageNumber, pageNumber, undefined, pageNumber === page)}
                </PaginationItem>
              </React.Fragment>
            ))}
            {hasNextPage && (
              <PaginationItem>
                {linkedPage(
                  page + 1,
                  <>
                    Next <ChevronRight size={16} />
                  </>,
                  'Go to next page',
                )}
              </PaginationItem>
            )}
          </PaginationContent>
        </PaginationComponent>
      </div>
    )
  }

  return (
    <div className={cn(styles.pagination, className)}>
      <PaginationComponent>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              disabled={!hasPrevPage}
              onClick={() => {
                router.push(pageHref(page - 1))
              }}
            />
          </PaginationItem>

          {hasExtraPrevPages && (
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          )}

          {hasPrevPage && (
            <PaginationItem>
              <PaginationLink
                onClick={() => {
                  router.push(pageHref(page - 1))
                }}
              >
                {page - 1}
              </PaginationLink>
            </PaginationItem>
          )}

          <PaginationItem>
            <PaginationLink
              isActive
              onClick={() => {
                router.push(pageHref(page))
              }}
            >
              {page}
            </PaginationLink>
          </PaginationItem>

          {hasNextPage && (
            <PaginationItem>
              <PaginationLink
                onClick={() => {
                  router.push(pageHref(page + 1))
                }}
              >
                {page + 1}
              </PaginationLink>
            </PaginationItem>
          )}

          {hasExtraNextPages && (
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          )}

          <PaginationItem>
            <PaginationNext
              disabled={!hasNextPage}
              onClick={() => {
                router.push(pageHref(page + 1))
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </PaginationComponent>
    </div>
  )
}
