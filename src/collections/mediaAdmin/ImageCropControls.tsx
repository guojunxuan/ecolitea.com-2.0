'use client'

import {
  Banner,
  Button,
  DialogBody,
  DialogCancel,
  DialogConfirm,
  DialogFooter,
  DialogHeader,
  DialogModal,
  Tabs,
  useDocumentInfo,
  useField,
  useForm,
  useFormFields,
  useModal,
  useUploadEdits,
} from '@payloadcms/ui'
import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import ReactCrop, { type PercentCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

import {
  MEDIA_UPLOAD_POLICY,
  validateImageDimensions,
  imageTypeNames,
} from '../mediaUploadPolicy.shared'
import styles from './ImageCropControls.module.css'

const ratios = MEDIA_UPLOAD_POLICY.image.ratios
const centeredCrop = (width: number, height: number, aspect: number): PercentCrop => {
  const cropWidth = Math.min(width, height * aspect)
  const cropHeight = cropWidth / aspect
  return {
    unit: '%',
    x: ((width - cropWidth) / width) * 50,
    y: ((height - cropHeight) / height) * 50,
    width: (cropWidth / width) * 100,
    height: (cropHeight / height) * 100,
  }
}

export const ImageCropControls = () => {
  const file = useFormFields(([fields]) => fields.file?.value)
  const { setValue: setFile } = useField<File | null>({ path: 'file' })
  const { data } = useDocumentInfo()
  const { updateUploadEdits } = useUploadEdits()
  const { setModified } = useForm()
  const { openModal, closeModal, modalState } = useModal()
  const slug = `media-image-crop-${useId()}`
  const isOpen = Boolean(modalState[slug]?.isOpen)
  const [source, setSource] = useState('')
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [ratioLabel, setRatioLabel] = useState<string>('1:1')
  const [crop, setCrop] = useState<PercentCrop>()
  const [automatic, setAutomatic] = useState(false)
  const selectedFile = useRef<unknown>(file instanceof File ? file : undefined)
  const loadedSource = useRef('')
  const session = useRef<{ automatic: boolean; file: unknown } | null>(null)
  const wasOpen = useRef(false)
  const updateRef = useRef(updateUploadEdits)
  useEffect(() => {
    updateRef.current = updateUploadEdits
  }, [updateUploadEdits])

  const clearSelectedFile = useCallback(() => {
    setFile(null)
    updateRef.current({ crop: undefined, widthInPixels: undefined, heightInPixels: undefined })
  }, [setFile])

  // Payload closes its modal for Escape as well as its public cancel controls.
  // An automatic session may only keep the selected file after Apply crop.
  useEffect(() => {
    if (wasOpen.current && !isOpen) {
      const abandoned = session.current
      session.current = null
      if (abandoned?.automatic && abandoned.file === file) clearSelectedFile()
    }
    wasOpen.current = isOpen
  }, [isOpen, file, clearSelectedFile])

  useEffect(() => {
    const nextFile = file instanceof File ? file : undefined
    if (selectedFile.current !== nextFile) {
      selectedFile.current = nextFile
      session.current = null
      closeModal(slug)
      updateRef.current({ crop: undefined, widthInPixels: undefined, heightInPixels: undefined })
      setDimensions({ width: 0, height: 0 })
      loadedSource.current = ''
    }
    if (!(file instanceof File) || !file.type.startsWith('image/')) {
      // Blob URLs are external resources owned and revoked by this effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSource('')
      return
    }
    const url = URL.createObjectURL(file)
    setSource(url)
    return () => URL.revokeObjectURL(url)
  }, [file, closeModal, slug])

  const existingImage =
    !file && data?.mimeType?.startsWith('image/') && typeof data.url === 'string' ? data.url : ''
  const imageSource = source || existingImage
  const readDimensions = useCallback(
    (image: HTMLImageElement) => {
      const width = image.naturalWidth
      const height = image.naturalHeight
      if (!width || !height || loadedSource.current === imageSource) return
      loadedSource.current = imageSource
      setDimensions({ width, height })
      const nearest = ratios.reduce((best, candidate) =>
        Math.abs(Math.log(width / height / (candidate.width / candidate.height))) <
        Math.abs(Math.log(width / height / (best.width / best.height)))
          ? candidate
          : best,
      )
      setRatioLabel(nearest.label)
      setCrop(centeredCrop(width, height, nearest.width / nearest.height))
      if (file instanceof File && source && validateImageDimensions(width, height) !== true) {
        session.current = { automatic: true, file }
        setAutomatic(true)
        openModal(slug)
      }
    },
    [imageSource, file, source, openModal, slug],
  )
  const loaderRef = useCallback(
    (image: HTMLImageElement | null) => {
      if (image?.complete && image.naturalWidth > 0) readDimensions(image)
    },
    [readDimensions],
  )

  const cancel = () => {
    const abandoned = session.current
    session.current = null
    if (abandoned?.automatic && abandoned.file === file) clearSelectedFile()
    closeModal(slug)
  }
  const apply = () => {
    if (!crop || !dimensions.width || !dimensions.height) return
    session.current = null
    updateUploadEdits({
      crop,
      widthInPixels: Math.round((crop.width / 100) * dimensions.width),
      heightInPixels: Math.round((crop.height / 100) * dimensions.height),
    })
    setModified(true)
    closeModal(slug)
  }
  if (!imageSource) return null
  const ratio = ratios.find(({ label }) => label === ratioLabel) || ratios[0]
  return (
    <div className={styles.controls}>
      {/* Read the original dimensions without changing Payload's native preview. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt="Crop source"
        className={styles.loader}
        key={imageSource}
        onLoad={(event) => readDimensions(event.currentTarget)}
        ref={loaderRef}
        src={imageSource}
      />
      <Button
        buttonStyle="secondary"
        size="medium"
        disabled={!dimensions.width}
        onClick={() => {
          session.current = { automatic: false, file }
          setAutomatic(false)
          openModal(slug)
        }}
      >
        Crop image
      </Button>
      <DialogModal size="large" slug={slug}>
        <DialogHeader
          title={automatic ? 'Crop image to a supported ratio' : 'Crop image'}
          showClose
          onClose={cancel}
        />
        <DialogBody>
          <div className={styles.body}>
            {automatic && (
              <Banner type="warning">
                This image is {dimensions.width} × {dimensions.height} (
                {(dimensions.width / dimensions.height).toFixed(2)}:1), which is not a supported
                ratio. Choose a ratio and adjust the crop.
              </Banner>
            )}
            <div aria-label="Aspect ratio">
              <Tabs
                value={ratioLabel}
                tabs={ratios.map(({ label }) => ({ label, value: label }))}
                onChange={(label) => {
                  const selected = ratios.find((ratio) => ratio.label === label) || ratios[0]
                  setRatioLabel(selected.label)
                  setCrop(
                    centeredCrop(
                      dimensions.width,
                      dimensions.height,
                      selected.width / selected.height,
                    ),
                  )
                }}
              />
            </div>
            <div className={styles.cropArea}>
              <ReactCrop
                aspect={ratio.width / ratio.height}
                crop={crop}
                keepSelection
                onChange={(_, percent) => setCrop(percent)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="Select crop area" className={styles.image} src={imageSource} />
              </ReactCrop>
            </div>
            <p>
              Result: {Math.round(((crop?.width ?? 0) / 100) * dimensions.width)} ×{' '}
              {Math.round(((crop?.height ?? 0) / 100) * dimensions.height)} · {ratioLabel}
            </p>
            <small>Images: {imageTypeNames}</small>
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogCancel label={automatic ? 'Choose another file' : 'Cancel'} onClick={cancel} />
          <DialogConfirm label="Apply crop" onClick={apply} />
        </DialogFooter>
      </DialogModal>
    </div>
  )
}
