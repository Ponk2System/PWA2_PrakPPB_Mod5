import { useState } from 'react'
import { Share2, Check, Archive, Camera } from 'lucide-react'
import FavoriteButton from '../common/FavoriteButton'
import { formatPrice, truncate } from '../../utils/helpers'

/**
 * Product card used in the catalog grid.
 *
 * @param {Object}   props
 * @param {Object}   props.gun       — product data
 * @param {Function} props.onSelect  — called with the gun when clicked
 * @param {Function} [props.onEdit]  — called when Edit is clicked (admin)
 * @param {Function} [props.onDelete]— called when Delete is clicked (admin)
 * @param {Function} [props.onArchive]— called when Archive is clicked
 */
export default function GunCard({ gun, onSelect, onEdit, onDelete, onArchive }) {
  const [copied, setCopied] = useState(false)
  const imgSrc = gun.image_url || gun.image || '/guns/pistol.svg'
  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0
  const imageCount = Array.isArray(gun.images) ? gun.images.length : 1

  const handleShare = async (e) => {
    e.stopPropagation()
    const shareUrl = `${window.location.origin}${window.location.pathname}?gun=${encodeURIComponent(gun.id || gun.name)}`
    const shareData = {
      title: `${gun.name} — Bore & Barrel`,
      text: `Take a look at the ${gun.name} (${caliber || category}) at Bore & Barrel!`,
      url: shareUrl,
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        if (err.name !== 'AbortError') {
          copyFallback(shareUrl)
        }
      }
    } else {
      copyFallback(shareUrl)
    }
  }

  const copyFallback = (url) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    } else {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <li className="card">
      <button
        type="button"
        className="card-btn"
        onClick={() => onSelect(gun)}
        aria-label={`View ${gun.name}`}
      >
        <div className="card-img-container" style={{ position: 'relative' }}>
          <img
            className="card-img"
            src={imgSrc}
            alt={gun.name}
            width="240"
            height="180"
            loading="lazy"
          />
          {imageCount > 1 && (
            <span
              className="card-img-badge"
              title={`${imageCount} images available`}
            >
              <Camera size={12} /> {imageCount}
            </span>
          )}
        </div>

        <span className="name display">{gun.name}</span>

        <span className="type">
          {category}
          {caliber ? ` · ${caliber}` : ''}
        </span>

        {gun.description && (
          <span className="card-desc">{truncate(gun.description, 72)}</span>
        )}

        <span className="price">{formatPrice(price)}</span>
      </button>

      {/* Floating actions row */}
      <div className="card-actions">
        <FavoriteButton gunId={gun.id || gun.name} />

        <button
          type="button"
          className={`card-act-btn ${copied ? 'card-act-btn--success' : ''}`}
          onClick={handleShare}
          aria-label={`Share link for ${gun.name}`}
          title={copied ? 'Link copied!' : 'Share catalog link'}
        >
          {copied ? <Check size={16} /> : <Share2 size={16} />}
        </button>

        {onArchive && (
          <button
            type="button"
            className="card-act-btn"
            onClick={(e) => {
              e.stopPropagation()
              onArchive(gun)
            }}
            aria-label={`Archive ${gun.name}`}
            title="Arsipkan katalog ini"
          >
            <Archive size={16} />
          </button>
        )}

        {onEdit && (
          <button
            type="button"
            className="card-act-btn"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(gun)
            }}
            aria-label={`Edit ${gun.name}`}
            title="Edit"
          >
            ✏️
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            className="card-act-btn card-act-btn--danger"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(gun)
            }}
            aria-label={`Delete ${gun.name}`}
            title="Delete"
          >
            🗑️
          </button>
        )}
      </div>
    </li>
  )
}
