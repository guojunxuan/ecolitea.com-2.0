'use client'

import { mergeFieldStyles, RelationshipInput, useField, useModal } from '@payloadcms/ui'
import type {
  RelationshipFieldClientProps,
  RelationshipValue,
  Validate,
  ValueWithRelation,
} from 'payload'
import { useCallback, useMemo } from 'react'

import { SocialPlatformCreateModal } from './SocialPlatformCreateModal'

const createSocialPlatformSentinel = '__create_social_platform__'
type DisplayOption = {
  allowEdit: boolean
  label: string
  options?: DisplayOption[]
  relationTo?: string
  value: number | string
}
type DisplayOptionGroup = { label: string; options: DisplayOption[] }

const createSocialPlatformOption: DisplayOption = {
  allowEdit: false,
  label: 'Create Social Platform',
  value: createSocialPlatformSentinel,
}

const getModalSlug = (path: string): string => {
  let hash = 0
  for (const character of path) hash = (hash * 31 + character.charCodeAt(0)) >>> 0

  const safePath = path.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'field'
  return `create-social-platform-${safePath}-${hash.toString(36)}`
}

const appendCreateOption = (optionGroups: DisplayOptionGroup[]): DisplayOption[] => [
  ...optionGroups.flatMap((group) => group.options),
  createSocialPlatformOption,
]

export const SocialPlatformRelationshipField = ({
  field,
  path: pathFromProps,
  readOnly,
  validate,
}: RelationshipFieldClientProps) => {
  const {
    admin: {
      allowEdit = true,
      appearance = 'select',
      className,
      description,
      isSortable = true,
      placeholder,
      sortOptions,
    } = {},
    label,
    localized,
    relationTo: relationToProp,
    required,
  } = field
  const memoizedValidate = useCallback(
    (
      value: RelationshipValue | null | undefined,
      options: Parameters<NonNullable<typeof validate>>[1],
    ) => validate?.(value, { ...options, required }),
    [required, validate],
  )
  const {
    customComponents: { AfterInput, BeforeInput, Description, Error, Label } = {},
    disabled,
    filterOptions,
    initialValue,
    path,
    setValue,
    showError,
    value,
  } = useField<number | string | null>({
    potentiallyStalePath: pathFromProps,
    validate: memoizedValidate as Validate,
  })
  const { closeModal, openModal } = useModal()
  const modalSlug = useMemo(() => getModalSlug(path), [path])
  const relationTo = useMemo(
    () => (Array.isArray(relationToProp) ? relationToProp : [relationToProp]),
    [relationToProp],
  )
  const styles = useMemo(() => mergeFieldStyles(field), [field])
  const toInputValue = useCallback(
    (fieldValue: null | number | string | undefined): null | ValueWithRelation =>
      fieldValue == null ? null : { relationTo: relationTo[0], value: fieldValue },
    [relationTo],
  )
  const handleChange = useCallback(
    (newValue: ValueWithRelation) => {
      if (newValue?.value === createSocialPlatformSentinel) {
        openModal(modalSlug)
        return
      }

      setValue(newValue ? newValue.value : null)
    },
    [modalSlug, openModal, setValue],
  )

  return (
    <>
      <RelationshipInput
        AfterInput={AfterInput}
        allowCreate={false}
        allowEdit={allowEdit}
        appearance={appearance}
        BeforeInput={BeforeInput}
        className={className}
        Description={Description}
        description={description}
        Error={Error}
        filterOptions={filterOptions}
        formatDisplayedOptions={appendCreateOption}
        hasMany={false}
        initialValue={toInputValue(initialValue)}
        isSortable={isSortable}
        Label={Label}
        label={label}
        localized={localized}
        maxResultsPerRequest={10}
        path={path}
        placeholder={placeholder}
        readOnly={readOnly || disabled}
        relationTo={relationTo}
        required={required}
        showError={showError}
        sortOptions={sortOptions}
        style={styles}
        onChange={handleChange}
        value={toInputValue(value)}
      />
      <SocialPlatformCreateModal
        modalSlug={modalSlug}
        onCreated={(document) => {
          setValue(document.id)
          closeModal(modalSlug)
        }}
      />
    </>
  )
}
