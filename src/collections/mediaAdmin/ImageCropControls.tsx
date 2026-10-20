'use client'

import {
  Banner,
  DialogBody,
  DialogCancel,
  DialogConfirm,
  DialogFooter,
  DialogHeader,
  DialogModal,
  Tabs,
  useField,
  useForm,
  useFormFields,
  useModal,
  useUploadEdits,
} from '@payloadcms/ui'
import type { UploadEdits } from 'payload'
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

const readBytes = (blob: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })

// Native filename edits wrap the same bytes in a new File. Metadata alone is
// insufficient: a genuine replacement can have the same size and timestamp.
const hasSameImageBytes = async (previous: File, next: File, signal: AbortSignal) => {
  const chunkSize = 64 * 1024
  for (let offset = 0; offset < previous.size; offset += chunkSize) {
    if (signal.aborted) return false
    const [before, after] = await Promise.all([
      readBytes(previous.slice(offset, offset + chunkSize)),
      readBytes(next.slice(offset, offset + chunkSize)),
    ])
    if (before.some((byte, index) => byte !== after[index])) return false
  }
  return !signal.aborted
}

export const ImageCropControls = () => {
  const file = useFormFields(([fields]) => fields.file?.value)
  const { setValue: setFile } = useField<File | null>({ path: 'file' })
  const { updateUploadEdits, getUploadEdits } = useUploadEdits()
  const { setModified, setBackgroundProcessing } = useForm()
  const { openModal, closeModal, modalState } = useModal()
  const slug = `media-image-crop-${useId()}`
  const isOpen = Boolean(modalState[slug]?.isOpen)
  const [source, setSource] = useState<{ file: File; url: string } | null>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [ratioLabel, setRatioLabel] = useState<string>('1:1')
  const [crop, setCrop] = useState<PercentCrop>()
  const selectedFile = useRef<unknown>(file instanceof File ? file : undefined)
  const pendingCrop = useRef<Pick<UploadEdits, 'crop' | 'widthInPixels' | 'heightInPixels'> | null>(
    null,
  )
  const getEditsRef = useRef(getUploadEdits)
  const loadedSource = useRef('')
  const session = useRef<File | null>(null)
  const wasOpen = useRef(false)
  const updateRef = useRef(updateUploadEdits)
  useEffect(() => {
    updateRef.current = updateUploadEdits
    getEditsRef.current = getUploadEdits
  }, [updateUploadEdits, getUploadEdits])

  const clearSelectedFile = useCallback(() => {
    setFile(null)
    updateRef.current({ crop: undefined, widthInPixels: undefined, heightInPixels: undefined })
  }, [setFile])

  // Payload closes its modal for Escape as well as its public cancel controls.
  // A crop session may only keep the selected file after Apply crop.
  useEffect(() => {
    if (wasOpen.current && !isOpen) {
      const abandoned = session.current
      session.current = null
      if (abandoned && abandoned === file) clearSelectedFile()
    }
    wasOpen.current = isOpen
  }, [isOpen, file, clearSelectedFile])

  useEffect(() => {
    const nextFile = file instanceof File ? file : undefined
    const previous = selectedFile.current
    const controller = new AbortController()
    let url: string | undefined
    let comparing = false
    const selectSource = (renamed: boolean) => {
      if (controller.signal.aborted) return
      selectedFile.current = nextFile
      if (renamed && pendingCrop.current) updateRef.current(pendingCrop.current)
      pendingCrop.current = null
      if (comparing) setBackgroundProcessing(false)
      if (previous !== nextFile && !renamed) {
        session.current = null
        closeModal(slug)
        updateRef.current({ crop: undefined, widthInPixels: undefined, heightInPixels: undefined })
        setDimensions({ width: 0, height: 0 })
        loadedSource.current = ''
      }
      if (!nextFile || !nextFile.type.startsWith('image/')) {
        setSource(null)
        return
      }
      url = URL.createObjectURL(nextFile)
      if (renamed) {
        if (loadedSource.current) loadedSource.current = url
        if (session.current === previous) session.current = nextFile
      }
      setSource({ file: nextFile, url })
    }
    if (
      previous instanceof File &&
      nextFile &&
      nextFile !== previous &&
      nextFile.type.startsWith('image/') &&
      nextFile.type === previous.type &&
      nextFile.size === previous.size &&
      nextFile.lastModified === previous.lastModified
    ) {
      comparing = true
      // Keep the native filename input usable, but pause manual saves while
      // content identity is unresolved. No submit can reuse the old crop.
      setBackgroundProcessing(true)
      if (!pendingCrop.current) {
        const { crop, widthInPixels, heightInPixels } = getEditsRef.current()
        pendingCrop.current = { crop, widthInPixels, heightInPixels }
      }
      updateRef.current({ crop: undefined, widthInPixels: undefined, heightInPixels: undefined })
      void hasSameImageBytes(previous, nextFile, controller.signal).then(selectSource, () =>
        selectSource(false),
      )
    } else {
      // Blob URL setup and cleanup belong to the selected file's effect.
      selectSource(false)
    }
    return () => {
      controller.abort()
      if (comparing) setBackgroundProcessing(false)
      if (url) URL.revokeObjectURL(url)
    }
  }, [file, closeModal, slug, setBackgroundProcessing])

  const imageSource = source && source.file === file ? source.url : ''
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
      if (file instanceof File && validateImageDimensions(width, height) !== true) {
        session.current = file
        openModal(slug)
      }
    },
    [imageSource, file, openModal, slug],
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
    if (abandoned && abandoned === file) clearSelectedFile()
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
    <>
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
      <DialogModal size="large" slug={slug}>
        <DialogHeader title="Crop image to a supported ratio" showClose onClose={cancel} />
        <DialogBody>
          <div className={styles.body}>
            <Banner type="warning">
              This image is {dimensions.width} × {dimensions.height} (
              {(dimensions.width / dimensions.height).toFixed(2)}:1), which is not a supported
              ratio. Choose a ratio and adjust the crop.
            </Banner>
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
          <DialogCancel label="Choose another file" onClick={cancel} />
          <DialogConfirm label="Apply crop" onClick={apply} />
        </DialogFooter>
      </DialogModal>
    </>
  )
}
