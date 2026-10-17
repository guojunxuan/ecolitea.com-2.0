'use client'

import { useDocumentInfo, useForm, useFormFields, useUploadEdits } from '@payloadcms/ui'
import React, { useEffect, useRef, useState } from 'react'
import ReactCrop, { type PercentCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

import { MEDIA_UPLOAD_POLICY, validateImageDimensions } from '../mediaUploadPolicy.shared'
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
  const { data } = useDocumentInfo()
  const { updateUploadEdits } = useUploadEdits()
  const { setModified } = useForm()
  const [source, setSource] = useState('')
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [ratioLabel, setRatioLabel] = useState<string>('1:1')
  const [crop, setCrop] = useState<PercentCrop>()
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const selectedFile = useRef<unknown>(undefined)
  const updateRef = useRef(updateUploadEdits)
  useEffect(() => {
    updateRef.current = updateUploadEdits
  }, [updateUploadEdits])

  useEffect(() => {
    if (selectedFile.current !== file) {
      selectedFile.current = file
      updateRef.current({ crop: undefined, widthInPixels: undefined, heightInPixels: undefined })
      setOpen(false)
      setDimensions({ width: 0, height: 0 })
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
  }, [file])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal?.()
    if (!open && dialog.open) dialog.close?.()
  }, [open])

  const existingImage =
    !file && data?.mimeType?.startsWith('image/') && typeof data.url === 'string' ? data.url : ''
  const imageSource = source || existingImage
  if (!imageSource) return null
  const ratio = ratios.find(({ label }) => label === ratioLabel) || ratios[0]
  const onLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const width = event.currentTarget.naturalWidth
    const height = event.currentTarget.naturalHeight
    if (!width || !height) return
    setDimensions({ width, height })
    const nearest = ratios.reduce((best, candidate) =>
      Math.abs(Math.log(width / height / (candidate.width / candidate.height))) <
      Math.abs(Math.log(width / height / (best.width / best.height)))
        ? candidate
        : best,
    )
    setRatioLabel(nearest.label)
    setCrop(centeredCrop(width, height, nearest.width / nearest.height))
    if (source && validateImageDimensions(width, height) !== true) setOpen(true)
  }
  const apply = () => {
    if (!crop || !dimensions.width || !dimensions.height) return
    updateUploadEdits({
      crop,
      widthInPixels: Math.round((crop.width / 100) * dimensions.width),
      heightInPixels: Math.round((crop.height / 100) * dimensions.height),
    })
    setModified(true)
    setOpen(false)
  }
  return (
    <div className={styles.controls}>
      {/* A separate loader reads natural dimensions without changing Payload's preview. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="Crop source" className={styles.loader} onLoad={onLoad} src={imageSource} />
      <button disabled={!dimensions.width} onClick={() => setOpen(true)} type="button">
        Crop image
      </button>
      {open && (
        <dialog
          aria-label="Crop image"
          className={styles.dialog}
          onCancel={() => setOpen(false)}
          open={typeof HTMLDialogElement.prototype.showModal !== 'function'}
          ref={dialogRef}
        >
          <h2>Crop image</h2>
          <label>
            Aspect ratio{' '}
            <select
              aria-label="Aspect ratio"
              onChange={(event) => {
                const selected =
                  ratios.find(({ label }) => label === event.target.value) || ratios[0]
                setRatioLabel(selected.label)
                setCrop(
                  centeredCrop(
                    dimensions.width,
                    dimensions.height,
                    selected.width / selected.height,
                  ),
                )
              }}
              value={ratioLabel}
            >
              {ratios.map(({ label }) => (
                <option key={label}>{label}</option>
              ))}
            </select>
          </label>
          <ReactCrop
            aspect={ratio.width / ratio.height}
            crop={crop}
            keepSelection
            onChange={(_, percent) => setCrop(percent)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="Select crop area" className={styles.image} src={imageSource} />
          </ReactCrop>
          <div className={styles.actions}>
            <button onClick={() => setOpen(false)} type="button">
              Cancel
            </button>
            <button onClick={apply} type="button">
              Apply crop
            </button>
          </div>
        </dialog>
      )}
    </div>
  )
}
