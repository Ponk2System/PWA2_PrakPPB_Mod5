import { useState, useEffect } from 'react'
import {
  Shield,
  Copy,
  Check,
  Save,
  Heart,
  FileText,
  Camera,
  Play,
  Edit3,
  X,
  Archive,
  RotateCcw,
  Trash2,
  ExternalLink,
  MapPin,
  Phone,
  Clock,
  UserCheck,
} from 'lucide-react'
import userService from '../services/userService'
import gunService from '../services/gunService'
import { useFavorites } from '../hooks/useFavorites'
import {
  getAllDraftIds,
  loadDraft,
  deleteDraft,
  getDraftTimestamp,
  formatDraftTime,
} from '../utils/draftStorage'
import {
  getArchivedGuns,
  restoreGun,
  deleteArchivedGunPermanently,
  ARCHIVE_EVENT,
} from '../utils/archiveStorage'
import { formatPrice } from '../utils/helpers'

/**
 * ProfilePage — User identity, Saved Drafts, Archived Hardware,
 * and Armory About & Contact information.
 */
export default function ProfilePage({ onReplaySplash, onNavigate }) {
  const [profile, setProfile] = useState(() => userService.getUserProfile())
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState('')

  // Edit Profile Modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [tempUsername, setTempUsername] = useState(profile.username || 'Shooter')
  const [tempBio, setTempBio] = useState(profile.bio || '')
  const [tempAvatar, setTempAvatar] = useState(profile.avatar || null)

  // Drafts state
  const [draftsList, setDraftsList] = useState([])

  // Archived guns state
  const [archivedList, setArchivedList] = useState(() => getArchivedGuns())

  const { favorites } = useFavorites()

  // Load drafts
  const refreshDrafts = () => {
    const ids = getAllDraftIds()
    const loaded = ids.map((id) => {
      const data = loadDraft(id)
      const ts = getDraftTimestamp(id)
      return {
        id,
        data,
        timestamp: ts,
        name: data?.formData?.name || 'Untitled Hardware',
        type: data?.formData?.type || 'Standard',
        caliber: data?.formData?.caliber || '—',
        isEdit: id !== 'create',
      }
    })
    setDraftsList(loaded)
  }

  // Load archive
  const refreshArchive = () => {
    setArchivedList(getArchivedGuns())
  }

  useEffect(() => {
    refreshDrafts()
    refreshArchive()

    const handleArchiveUpdate = () => refreshArchive()
    window.addEventListener(ARCHIVE_EVENT, handleArchiveUpdate)
    return () => window.removeEventListener(ARCHIVE_EVENT, handleArchiveUpdate)
  }, [])

  const handleCopyId = () => {
    if (profile.userId) {
      navigator.clipboard.writeText(profile.userId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleOpenEditModal = () => {
    setTempUsername(profile.username || 'Shooter')
    setTempBio(profile.bio || '')
    setTempAvatar(profile.avatar || null)
    setShowEditModal(true)
  }

  const handleAvatarFile = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      alert('Avatar image must be under 2MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setTempAvatar(event.target.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveModalProfile = (e) => {
    e.preventDefault()
    const updated = {
      ...profile,
      username: tempUsername.trim() || 'Shooter',
      bio: tempBio.trim(),
      avatar: tempAvatar,
    }
    const result = userService.saveUserProfile(updated)
    if (result.success) {
      setProfile(result.data)
      setShowEditModal(false)
      setFeedback('Operator profile updated.')
      setTimeout(() => setFeedback(''), 3000)
    } else {
      alert('Failed to save profile.')
    }
  }

  // Draft operations
  const handleDeleteSingleDraft = (draftId) => {
    deleteDraft(draftId)
    refreshDrafts()
    setFeedback('Draft discarded.')
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleResumeDraft = (draft) => {
    if (onNavigate) {
      if (draft.isEdit) {
        onNavigate('Edit', { id: draft.id })
      } else {
        onNavigate('Create')
      }
    }
  }

  // Archive operations
  const handleRestoreGun = (gunId, gunName) => {
    restoreGun(gunId)
    refreshArchive()
    setFeedback(`"${gunName}" telah dipulihkan ke Catalog.`)
    setTimeout(() => setFeedback(''), 3500)
  }

  const handleDeletePermanent = async (gunId, gunName) => {
    if (window.confirm(`Hapus permanen "${gunName}"? Tindakan ini tidak dapat dibatalkan.`)) {
      try {
        deleteArchivedGunPermanently(gunId)
        await gunService.deleteGun(gunId)
        refreshArchive()
        setFeedback(`"${gunName}" dihapus permanen.`)
        setTimeout(() => setFeedback(''), 3500)
      } catch (err) {
        console.warn('Permanent delete failed on server:', err)
        deleteArchivedGunPermanently(gunId)
        refreshArchive()
      }
    }
  }

  return (
    <div className="profile-page">
      <section className="masthead" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="display">Operator Profile</h1>
          <p className="lede">
            Operator credentials, saved drafts, archived catalog items, and armory info.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {onReplaySplash && (
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={onReplaySplash}
              title="Replay introductory splash animation"
            >
              <Play size={14} /> Replay Intro
            </button>
          )}
        </div>
      </section>

      {feedback && (
        <div className="toast toast--success">
          <Check size={18} /> {feedback}
        </div>
      )}

      {/* Operator Card */}
      <div className="profile-card">
        <div className="profile-card-top">
          <div className="avatar-wrap">
            {profile.avatar ? (
              <img src={profile.avatar} alt={profile.username} className="avatar-img" />
            ) : (
              <div className="avatar-placeholder">
                <Shield size={36} stroke="var(--brass)" />
              </div>
            )}
          </div>

          <div className="profile-identity">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h2 className="display" style={{ margin: 0 }}>{profile.username || 'Shooter'}</h2>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={handleOpenEditModal}
                title="Edit Callsign, Bio, and Avatar"
              >
                <Edit3 size={14} /> Edit Profile
              </button>
            </div>

            {profile.bio && (
              <p className="profile-bio-text" style={{ margin: '6px 0 10px', color: 'var(--muted)', fontSize: '0.9rem' }}>
                {profile.bio}
              </p>
            )}

            <div className="profile-id-row">
              <span className="mono-badge">{profile.userId}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={handleCopyId}
                title="Copy User ID to clipboard"
              >
                {copied ? <Check size={14} color="var(--brass)" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="profile-stats">
          <div className="stat-item">
            <Heart size={20} className="stat-icon" stroke="var(--brass)" />
            <div className="stat-val">{favorites.length}</div>
            <div className="stat-label">Procurement Favorites</div>
          </div>
          <div className="stat-item">
            <FileText size={20} className="stat-icon" stroke="var(--steel)" />
            <div className="stat-val">{draftsList.length}</div>
            <div className="stat-label">Saved Offline Drafts</div>
          </div>
          <div className="stat-item">
            <Archive size={20} className="stat-icon" stroke="var(--brass)" />
            <div className="stat-val">{archivedList.length}</div>
            <div className="stat-label">Archived Hardware</div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Saved Drafts (Katalog Draft) */}
      <section className="profile-section" style={{ marginTop: '36px' }}>
        <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <FileText size={20} stroke="var(--brass)" />
              Saved Drafts ({draftsList.length})
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
              Unfinished catalog registrations stored locally in browser storage.
            </p>
          </div>
        </div>

        {draftsList.length > 0 ? (
          <div className="draft-grid">
            {draftsList.map((draft) => (
              <div key={draft.id} className="draft-card">
                <div className="draft-card-main">
                  <span className="draft-badge">
                    {draft.isEdit ? 'Edit Form' : 'New Registration'}
                  </span>
                  <h3 className="draft-title">{draft.name}</h3>
                  <p className="draft-subtitle">
                    {draft.type} {draft.caliber ? `· ${draft.caliber}` : ''}
                  </p>
                  <span className="draft-time">
                    Saved: {formatDraftTime(draft.timestamp)}
                  </span>
                </div>

                <div className="draft-card-actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => handleResumeDraft(draft)}
                  >
                    <ExternalLink size={14} /> Continue Editing
                  </button>
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={() => handleDeleteSingleDraft(draft.id)}
                    title="Discard draft"
                  >
                    <Trash2 size={14} /> Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="state-box" style={{ padding: '24px' }}>
            <FileText size={28} />
            <p>No pending drafts. Start registering hardware to auto-save drafts.</p>
          </div>
        )}
      </section>

      {/* SECTION 2: Archived Hardware (Katalog yang Diarsipkan) */}
      <section className="profile-section" style={{ marginTop: '40px' }}>
        <div className="section-head" style={{ marginBottom: '16px' }}>
          <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Archive size={20} stroke="var(--brass)" />
            Archived Hardware ({archivedList.length})
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
            Hardware hidden from the public catalog. You can restore them anytime or remove permanently.
          </p>
        </div>

        {archivedList.length > 0 ? (
          <div className="archive-grid">
            {archivedList.map((gun) => (
              <div key={gun.id} className="archive-card">
                <img
                  src={gun.image_url || gun.image || '/guns/pistol.svg'}
                  alt={gun.name}
                  className="archive-card-img"
                />
                <div className="archive-card-body">
                  <h3 className="archive-card-title">{gun.name}</h3>
                  <p className="archive-card-meta">
                    {gun.type || gun.category || 'Hardware'} {gun.caliber ? `· ${gun.caliber}` : ''}
                  </p>
                  <p className="archive-card-price">{formatPrice(gun.price ?? gun.cook_time ?? 0)}</p>
                  {gun.archivedAt && (
                    <span className="archive-card-date">
                      Archived {new Date(gun.archivedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className="archive-card-actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => handleRestoreGun(gun.id, gun.name)}
                    title="Pulihkan katalog ke tampilan utama"
                  >
                    <RotateCcw size={14} /> Pulihkan
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => handleDeletePermanent(gun.id, gun.name)}
                    title="Hapus permanen dari database"
                  >
                    <Trash2 size={14} /> Hapus Permanen
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="state-box" style={{ padding: '24px' }}>
            <Archive size={28} />
            <p>No hardware records currently archived.</p>
          </div>
        )}
      </section>

      {/* SECTION 3: About Armory & Contact Us (Pindahan dari Navbar) */}
      <section className="profile-section armory-info-section" style={{ marginTop: '40px' }}>
        <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Shield size={20} stroke="var(--brass)" />
          About Bore &amp; Barrel &amp; Armory Headquarters
        </h2>

        <div className="armory-info-grid">
          <div className="card-box" style={{ margin: 0 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.1rem', color: 'var(--brass)' }}>
              A One-Room Armory
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--text)' }}>
              Bore &amp; Barrel sells a short, honest list of firearms. Each piece is priced
              directly from the bench — no markup theatre, no filler, and strict spec standards.
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--brass)' }}>
              <UserCheck size={14} /> Verified Operator Facility #40
            </div>
          </div>

          <div className="card-box" style={{ margin: 0 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.1rem', color: 'var(--brass)' }}>
              Contact &amp; Shop Visitation
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.9rem', lineHeight: 1.7 }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)' }}>
                <MapPin size={16} stroke="var(--brass)" /> 123 Range Road, Sector 7
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)' }}>
                <Clock size={16} stroke="var(--brass)" /> Open Tuesday to Saturday, 10:00 – 18:00
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)' }}>
                <Phone size={16} stroke="var(--brass)" /> Call: (555) 010-0100
              </li>
            </ul>
          </div>
        </div>

        {/* Student Developer Info Card */}
        <div className="student-badge-card" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={22} stroke="var(--brass)" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Cornelius Fransinatra Wijaya</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                NIM: 21120124140141 · Praktikum PPB Kelompok 40
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* POP-UP MODAL: Edit Profile */}
      {showEditModal && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="modal-card modal-profile" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Operator Profile</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowEditModal(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveModalProfile} className="modal-form">
              {/* Avatar Selector */}
              <div className="modal-avatar-picker">
                <div className="modal-avatar-preview">
                  {tempAvatar ? (
                    <img src={tempAvatar} alt="Preview" />
                  ) : (
                    <Shield size={32} stroke="var(--brass)" />
                  )}
                </div>
                <label className="btn btn--outline btn--sm" style={{ cursor: 'pointer' }}>
                  <Camera size={14} /> Change Avatar
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFile}
                    className="hidden-file-input"
                  />
                </label>
              </div>

              <div className="form-group">
                <label htmlFor="modal-prof-name" className="form-label">
                  Callsign / Operator Alias <span className="req">*</span>
                </label>
                <input
                  id="modal-prof-name"
                  type="text"
                  value={tempUsername}
                  onChange={(e) => setTempUsername(e.target.value)}
                  placeholder="e.g. Operator Delta, Master Gunsmith"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="modal-prof-bio" className="form-label">
                  Armory Notes / Station Bio
                </label>
                <textarea
                  id="modal-prof-bio"
                  value={tempBio}
                  onChange={(e) => setTempBio(e.target.value)}
                  placeholder="Qualifications, preferred calibers, unit assignment..."
                  rows={3}
                  className="form-textarea"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary">
                  <Save size={16} /> Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
