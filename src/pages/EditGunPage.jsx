import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Upload,
  X,
  Plus,
  Loader,
  Save,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react'
import gunService from '../services/gunService'
import uploadService from '../services/uploadService'
import {
  saveDraft,
  loadDraft,
  deleteDraft,
  hasDraft,
  getDraftTimestamp,
  formatDraftTime,
} from '../utils/draftStorage'
import ConfirmModal from '../components/modals/ConfirmModal'

/**
 * EditGunPage — Edit an existing weapon / hardware item.
 * Supports multi-image management, specs, steps, and draft management.
 */
export default function EditGunPage({ gun, gunId, onBack, onSuccess }) {
  const targetId = gunId || gun?.id

  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    type: 'Pistol',
    caliber: '9mm',
    category: 'makanan',
    difficulty: 'mudah',
    price: 599,
    description: '',
    servings: 1,
    is_featured: false,
  })

  // Multi-image list
  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const [customUrlInput, setCustomUrlInput] = useState('')

  // Specs & Steps
  const [specs, setSpecs] = useState([{ name: '', quantity: '' }])
  const [steps, setSteps] = useState([''])

  // Draft modal
  const [showDraftModal, setShowDraftModal] = useState(() => (targetId ? hasDraft(targetId) : false))
  const [draftTimestamp, setDraftTimestamp] = useState(() => (targetId ? getDraftTimestamp(targetId) : null))

  // Fetch initial data
  useEffect(() => {
    const fetchGun = async () => {
      try {
        setLoading(true)
        setError('')

        let data = gun
        if (!data || !data.ingredients || !data.steps) {
          if (targetId && !String(targetId).startsWith('local-')) {
            const res = await gunService.getGunById(targetId)
            if (res.success && res.data) {
              data = res.data
            }
          }
        }

        if (data) {
          setFormData({
            name: data.name || '',
            type: data.type || (data.category === 'makanan' ? 'Pistol' : 'Rifle'),
            caliber: data.caliber || '9mm',
            category: data.category || 'makanan',
            difficulty: data.difficulty || 'mudah',
            price: data.price ?? data.cook_time ?? 599,
            description: data.description || '',
            servings: data.servings || 1,
            is_featured: Boolean(data.is_featured),
          })

          const initialImages = Array.isArray(data.images) && data.images.length > 0
            ? data.images
            : [data.image_url || data.image || '/guns/pistol.svg']
          setImages(initialImages)

          if (data.ingredients && data.ingredients.length > 0) {
            setSpecs(
              data.ingredients.map((ing) => ({
                name: ing.name || '',
                quantity: ing.quantity || '',
              })),
            )
          } else {
            setSpecs([
              { name: 'Platform', quantity: data.type || 'Pistol' },
              { name: 'Caliber', quantity: data.caliber || '9mm' },
            ])
          }

          if (data.steps && data.steps.length > 0) {
            setSteps(
              data.steps.map((st) => (typeof st === 'string' ? st : st.instruction || '')),
            )
          } else {
            setSteps(['Standard manufacturer maintenance and cleaning protocol.'])
          }
        } else {
          setError('Hardware record could not be loaded.')
        }
      } catch (err) {
        setError(err.message || 'Failed to load hardware record from server.')
      } finally {
        setLoading(false)
      }
    }

    if (targetId) {
      fetchGun()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId])

  // Draft operations
  const handleLoadDraft = () => {
    const draft = loadDraft(targetId)
    if (draft) {
      if (draft.formData) setFormData(draft.formData)
      if (draft.specs) setSpecs(draft.specs)
      if (draft.steps) setSteps(draft.steps)
      if (Array.isArray(draft.images) && draft.images.length > 0) {
        setImages(draft.images)
      } else if (draft.imagePreview) {
        setImages([draft.imagePreview])
      }
      setShowDraftModal(false)
      setSuccessMsg('Saved draft restored.')
      setTimeout(() => setSuccessMsg(''), 3000)
    }
  }

  const handleDiscardDraft = () => {
    deleteDraft(targetId)
    setShowDraftModal(false)
    setDraftTimestamp(null)
  }

  const handleManualSaveDraft = () => {
    const draftData = {
      formData,
      specs,
      steps,
      images,
    }
    const saved = saveDraft(draftData, targetId)
    if (saved) {
      const ts = getDraftTimestamp(targetId)
      setDraftTimestamp(ts)
      setSuccessMsg(`Draft saved (${formatDraftTime(ts)})`)
      setTimeout(() => setSuccessMsg(''), 3000)
    }
  }

  // Handle multi-image upload
  const handleImagesUpload = async (e) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    const validFiles = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.size > 5 * 1024 * 1024) {
        setError(`File ${file.name} exceeds 5MB limit.`)
        return
      }
      if (!allowed.includes(file.type)) {
        setError(`File ${file.name} is not a supported format.`)
        return
      }
      validFiles.push(file)
    }

    try {
      setUploading(true)
      const res = await uploadService.uploadMultipleImages(validFiles)
      if (res.success && res.urls.length > 0) {
        setImages((prev) => [...prev, ...res.urls])
        setSuccessMsg(`Added ${res.urls.length} image(s).`)
        setTimeout(() => setSuccessMsg(''), 3000)
      }
    } catch (err) {
      console.warn('Image upload failed, using local object URLs:', err)
      const fallbackUrls = validFiles.map((f) => URL.createObjectURL(f))
      setImages((prev) => [...prev, ...fallbackUrls])
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleAddPreset = (url) => {
    setImages((prev) => [...prev, url])
  }

  const handleAddCustomUrl = (e) => {
    e.preventDefault()
    if (!customUrlInput.trim()) return
    setImages((prev) => [...prev, customUrlInput.trim()])
    setCustomUrlInput('')
  }

  const handleRemoveImage = (index) => {
    if (images.length <= 1) {
      alert('A product must retain at least one image.')
      return
    }
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSetPrimary = (index) => {
    if (index === 0) return
    setImages((prev) => {
      const copy = [...prev]
      const [item] = copy.splice(index, 1)
      copy.unshift(item)
      return copy
    })
  }

  // Specs & Steps
  const handleSpecChange = (index, field, value) => {
    setSpecs((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const addSpec = () => setSpecs((prev) => [...prev, { name: '', quantity: '' }])
  const removeSpec = (index) => {
    if (specs.length <= 1) return
    setSpecs((prev) => prev.filter((_, i) => i !== index))
  }

  const handleStepChange = (index, value) => {
    setSteps((prev) => {
      const copy = [...prev]
      copy[index] = value
      return copy
    })
  }

  const addStep = () => setSteps((prev) => [...prev, ''])
  const removeStep = (index) => {
    if (steps.length <= 1) return
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  // Submit update
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim() || formData.name.trim().length < 3) {
      setError('Product name must be at least 3 characters.')
      return
    }

    const cleanSpecs = specs
      .filter((s) => s.name.trim())
      .map((s) => ({
        name: s.name.trim(),
        quantity: s.quantity.trim() || 'Standard',
      }))

    if (cleanSpecs.length === 0) {
      setError('Please provide at least one specification.')
      return
    }

    const cleanSteps = steps
      .filter((s) => s.trim())
      .map((s) => s.trim())

    if (cleanSteps.length === 0) {
      setError('Please provide at least one maintenance step.')
      return
    }

    const activeImages = images.length > 0 ? images : ['/guns/pistol.svg']

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      category: formData.type === 'Pistol' ? 'makanan' : 'minuman',
      caliber: formData.caliber.trim(),
      price: Number(formData.price) || 500,
      description: formData.description.trim(),
      servings: Number(formData.servings) || 1,
      difficulty: formData.difficulty || 'mudah',
      is_featured: Boolean(formData.is_featured),
      image_url: activeImages[0],
      images: activeImages,
      ingredients: cleanSpecs,
      steps: cleanSteps,
    }

    try {
      setUpdating(true)
      const res = await gunService.updateGun(targetId, payload)
      if (res.success || res.data) {
        deleteDraft(targetId)
        if (onSuccess) {
          onSuccess(res.data)
        } else if (onBack) {
          onBack()
        }
      } else {
        throw new Error(res.message || 'Failed to update product.')
      }
    } catch (err) {
      setError(err.message || 'Error occurred while updating product.')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="state-box">
        <Loader size={32} className="spin" />
        <p>Loading hardware details…</p>
      </div>
    )
  }

  return (
    <div className="form-page">
      <div className="form-head">
        <button type="button" className="detail-back" onClick={onBack}>
          <ArrowLeft size={18} /> Cancel &amp; Return
        </button>
        <div className="form-head-actions">
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={handleManualSaveDraft}
            title="Save draft"
          >
            <Save size={14} /> Save Draft
          </button>
        </div>
      </div>

      <div className="form-title-group">
        <h1 className="display">Modify Hardware Record</h1>
        <p className="lede">
          Update specifications, multiple imagery, and operational steps for this firearm.
        </p>
      </div>

      {error && (
        <div className="toast toast--error">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {successMsg && (
        <div className="toast toast--success">
          <CheckCircle size={18} /> {successMsg}
        </div>
      )}

      {/* Imagery Management Section */}
      <div className="card-box" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h2 className="card-box-title" style={{ margin: 0 }}>
            <ImageIcon size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Catalog Imagery ({images.length})
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--brass)' }}>
            ★ Cover image is displayed in catalog cards
          </span>
        </div>

        {/* Existing images grid */}
        <div className="multi-image-grid" style={{ marginBottom: '16px' }}>
          {images.map((imgUrl, idx) => (
            <div key={idx} className={`multi-image-card ${idx === 0 ? 'is-primary' : ''}`}>
              <img src={imgUrl} alt={`Gun view ${idx + 1}`} />
              <div className="multi-image-overlay">
                {idx === 0 ? (
                  <span className="primary-pill">Primary</span>
                ) : (
                  <button
                    type="button"
                    className="btn-overlay-action"
                    onClick={() => handleSetPrimary(idx)}
                    title="Set as primary cover"
                  >
                    Make Cover
                  </button>
                )}
                <button
                  type="button"
                  className="btn-overlay-delete"
                  onClick={() => handleRemoveImage(idx)}
                  title="Remove image"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Upload more images */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <label className="btn btn--outline btn--sm" style={{ cursor: 'pointer' }}>
            {uploading ? (
              <><Loader size={14} className="spin" /> Uploading…</>
            ) : (
              <><Upload size={14} /> Upload More Images</>
            )}
            <input
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleImagesUpload}
              className="hidden-file-input"
            />
          </label>

          <button
            type="button"
            className="pill"
            onClick={() => handleAddPreset('/guns/pistol.svg')}
          >
            + Pistol Vector
          </button>
          <button
            type="button"
            className="pill"
            onClick={() => handleAddPreset('/guns/rifle.svg')}
          >
            + Rifle Vector
          </button>
        </div>

        <form onSubmit={handleAddCustomUrl} style={{ display: 'flex', gap: '8px', marginTop: '10px', maxWidth: '400px' }}>
          <input
            type="url"
            placeholder="Add image by URL: https://..."
            value={customUrlInput}
            onChange={(e) => setCustomUrlInput(e.target.value)}
            className="form-input"
            style={{ fontSize: '0.82rem' }}
          />
          <button type="submit" className="btn btn--outline btn--sm">
            + Add
          </button>
        </form>
      </div>

      <form onSubmit={handleSubmit} className="entry-form">
        {/* Basic Fields */}
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="name" className="form-label">
              Model Designation <span className="req">*</span>
            </label>
            <input
              id="name"
              type="text"
              name="name"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="type" className="form-label">
              Platform / Category <span className="req">*</span>
            </label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value }))}
              className="form-select"
            >
              <option value="Pistol">Pistol (Sidearm)</option>
              <option value="Rifle">Rifle (Long Gun)</option>
              <option value="Shotgun">Shotgun (Smoothbore)</option>
              <option value="Submachine Gun">Submachine Gun</option>
            </select>
          </div>
        </div>

        <div className="form-grid form-grid--3">
          <div className="form-group">
            <label htmlFor="caliber" className="form-label">
              Caliber <span className="req">*</span>
            </label>
            <input
              id="caliber"
              type="text"
              name="caliber"
              value={formData.caliber}
              onChange={(e) => setFormData((p) => ({ ...p, caliber: e.target.value }))}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="price" className="form-label">
              Price (USD) <span className="req">*</span>
            </label>
            <input
              id="price"
              type="number"
              name="price"
              value={formData.price}
              onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))}
              min="0"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="difficulty" className="form-label">
              Grade <span className="req">*</span>
            </label>
            <select
              id="difficulty"
              name="difficulty"
              value={formData.difficulty}
              onChange={(e) => setFormData((p) => ({ ...p, difficulty: e.target.value }))}
              className="form-select"
            >
              <option value="mudah">Commercial / Standard</option>
              <option value="sedang">Mil-Spec / Service Issue</option>
              <option value="sulit">Match Grade / Custom</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description" className="form-label">
            Armory Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            rows={3}
            className="form-textarea"
          />
        </div>

        {/* Specifications */}
        <div className="form-fieldset">
          <div className="fieldset-header">
            <label className="form-label">Specifications &amp; Components</label>
            <button type="button" className="btn btn--outline btn--sm" onClick={addSpec}>
              <Plus size={14} /> Add Spec
            </button>
          </div>
          <div className="multi-rows">
            {specs.map((spec, i) => (
              <div key={i} className="multi-row">
                <input
                  type="text"
                  placeholder="Attribute"
                  value={spec.name}
                  onChange={(e) => handleSpecChange(i, 'name', e.target.value)}
                  className="form-input"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={spec.quantity}
                  onChange={(e) => handleSpecChange(i, 'quantity', e.target.value)}
                  className="form-input"
                />
                <button
                  type="button"
                  className="btn btn--danger-ghost"
                  onClick={() => removeSpec(i)}
                  disabled={specs.length <= 1}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="form-fieldset">
          <div className="fieldset-header">
            <label className="form-label">Assembly &amp; Maintenance Protocol</label>
            <button type="button" className="btn btn--outline btn--sm" onClick={addStep}>
              <Plus size={14} /> Add Step
            </button>
          </div>
          <div className="multi-rows">
            {steps.map((st, i) => (
              <div key={i} className="step-row">
                <span className="step-num">{i + 1}</span>
                <input
                  type="text"
                  value={st}
                  onChange={(e) => handleStepChange(i, e.target.value)}
                  className="form-input"
                />
                <button
                  type="button"
                  className="btn btn--danger-ghost"
                  onClick={() => removeStep(i)}
                  disabled={steps.length <= 1}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="form-actions-bar">
          <button type="button" className="btn btn--outline" onClick={onBack} disabled={updating}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={updating}>
            {updating ? (
              <><Loader size={18} className="spin" /> Updating Record…</>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </form>

      {/* Restore Draft Modal */}
      <ConfirmModal
        open={showDraftModal}
        title="Resume Edit Draft?"
        message={`An unfinished edit draft from ${draftTimestamp ? formatDraftTime(draftTimestamp) : 'earlier'} was detected. Would you like to resume editing?`}
        confirmLabel="Load Draft"
        cancelLabel="Discard"
        onConfirm={handleLoadDraft}
        onCancel={handleDiscardDraft}
      />
    </div>
  )
}
