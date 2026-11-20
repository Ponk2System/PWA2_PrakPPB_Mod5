import { useState, useMemo } from 'react'
import {
  ArrowLeft,
  Star,
  Send,
  Loader,
  Share2,
  Check,
  Archive,
  ChevronLeft,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Edit2,
  Trash2,
  X,
  Save,
} from 'lucide-react'
import FavoriteButton from '../common/FavoriteButton'
import {
  useReviews,
  useCreateReview,
  useUpdateReview,
  useDeleteReview,
} from '../../hooks/useReviews'
import { getUserIdentifier } from '../../services/userService'
import { formatPrice, averageRating } from '../../utils/helpers'
import {
  getReviewReactionState,
  calculateNextReaction,
} from '../../utils/reviewReactions'
import reviewService from '../../services/reviewService'

/**
 * Full-screen product detail view with multi-image gallery,
 * archive action, and comprehensive review controls (edit/delete own, like/dislike others).
 */
export default function GunDetail({ gun, onBack, onEdit, onDelete, onArchive }) {
  const currentUserId = getUserIdentifier()

  // Multi-image gallery state
  const images = useMemo(() => {
    if (Array.isArray(gun.images) && gun.images.length > 0) {
      return gun.images
    }
    const fallback = gun.image_url || gun.image || '/guns/pistol.svg'
    return [fallback]
  }, [gun])

  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const currentDisplayImage = images[activeImageIndex] || images[0]

  const handlePrevImage = () => {
    setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
  }

  const handleNextImage = () => {
    setActiveImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
  }

  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0

  // Reviews
  const { reviews, loading: reviewsLoading, refetch: refetchReviews } = useReviews(gun.id)
  const { createReview, loading: submitting } = useCreateReview()
  const { updateReview, loading: updatingReview } = useUpdateReview()
  const { deleteReview, loading: deletingReview } = useDeleteReview()

  // New review form
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState('')

  // Edit review state (for user's own review)
  const [editingReviewId, setEditingReviewId] = useState(null)
  const [editRating, setEditRating] = useState(5)
  const [editComment, setEditComment] = useState('')
  const [editError, setEditError] = useState('')

  // Optimistic reactions state for real-time immediate updates
  const [optimisticReactions, setOptimisticReactions] = useState({})

  // Real-time polling effect to keep community reviews & reactions in sync
  useEffect(() => {
    if (!gun?.id) return
    const pollInterval = setInterval(() => {
      refetchReviews()
    }, 4000)
    return () => clearInterval(pollInterval)
  }, [gun?.id, refetchReviews])

  const avgRating = gun.average_rating || averageRating(reviews)
  const reviewCount = gun.review_count ?? reviews.length

  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?gun=${encodeURIComponent(gun.id || gun.name)}`
    const shareData = {
      title: `${gun.name} — Bore & Barrel`,
      text: `Check out ${gun.name} (${caliber || category}) at Bore & Barrel!`,
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

  const handleSubmitReview = async (e) => {
    e.preventDefault()
    setReviewError('')
    setReviewSuccess('')

    if (rating < 1 || rating > 5) {
      setReviewError('Rating must be between 1 and 5.')
      return
    }

    const result = await createReview(gun.id, {
      user_identifier: currentUserId,
      user_id: currentUserId,
      rating,
      comment: comment.trim(),
    })

    if (result) {
      setReviewSuccess('Review submitted!')
      setComment('')
      setRating(5)
      refetchReviews()
    } else {
      setReviewError('Could not submit review. The server may be unavailable.')
    }
  }

  const handleStartEditReview = (rev) => {
    setEditingReviewId(rev.id)
    setEditRating(rev.rating || 5)
    setEditComment(rev.comment || '')
    setEditError('')
  }

  const handleCancelEditReview = () => {
    setEditingReviewId(null)
    setEditError('')
  }

  const handleSaveEditReview = async (reviewId) => {
    setEditError('')
    const targetRev = reviews.find((r) => r.id === reviewId)
    const updated = await updateReview(reviewId, {
      rating: editRating,
      comment: editComment.trim(),
      raw_comment: targetRev?.raw_comment,
    })
    if (updated) {
      setEditingReviewId(null)
      refetchReviews()
    } else {
      setEditError('Failed to update review.')
    }
  }

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete your review?')) return
    const success = await deleteReview(reviewId)
    if (success) {
      refetchReviews()
    } else {
      alert('Failed to delete review.')
    }
  }

  const handleToggleReaction = async (rev, type) => {
    if (!rev?.id) return
    const current =
      optimisticReactions[rev.id] || getReviewReactionState(rev, currentUserId)
    const next = calculateNextReaction(rev.id, currentUserId, type, current)

    // 1. Instant optimistic state update for 0ms visual feedback
    setOptimisticReactions((prev) => ({
      ...prev,
      [rev.id]: next,
    }))

    // 2. Persist reaction to Supabase backend in background
    try {
      await reviewService.toggleReaction(rev.id, currentUserId, type)
      refetchReviews()
    } catch (err) {
      console.warn('Could not sync reaction to server:', err)
    }
  }

  return (
    <div className="detail">
      {/* Back button */}
      <button type="button" className="detail-back" onClick={onBack}>
        <ArrowLeft size={18} /> Back to Catalog
      </button>

      {/* Hero with Multi-image gallery */}
      <div className="detail-hero">
        <div className="detail-gallery">
          <div className="detail-img-wrap" style={{ position: 'relative' }}>
            <img
              className="detail-img"
              src={currentDisplayImage}
              alt={`${gun.name} view ${activeImageIndex + 1}`}
            />

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  className="gallery-arrow gallery-arrow--prev"
                  onClick={handlePrevImage}
                  aria-label="Previous image"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  className="gallery-arrow gallery-arrow--next"
                  onClick={handleNextImage}
                  aria-label="Next image"
                >
                  <ChevronRight size={20} />
                </button>
                <span className="gallery-counter">
                  {activeImageIndex + 1} / {images.length}
                </span>
              </>
            )}
          </div>

          {/* Thumbnails row if multiple images */}
          {images.length > 1 && (
            <div className="gallery-thumbnails">
              {images.map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`gallery-thumb-btn ${idx === activeImageIndex ? 'active' : ''}`}
                  onClick={() => setActiveImageIndex(idx)}
                  aria-label={`Select photo ${idx + 1}`}
                >
                  <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail-info">
          <h1 className="display">{gun.name}</h1>
          <p className="type">
            {category}
            {caliber ? ` · ${caliber}` : ''}
          </p>
          <p className="price detail-price">{formatPrice(price)}</p>

          {avgRating > 0 && (
            <p className="detail-rating">
              <Star size={16} fill="var(--brass)" stroke="var(--brass)" />
              {avgRating.toFixed(1)} ({reviewCount} review{reviewCount !== 1 ? 's' : ''})
            </p>
          )}

          <div className="detail-actions">
            <FavoriteButton gunId={gun.id || gun.name} />

            <button
              type="button"
              className={`btn btn--outline ${copied ? 'btn--success' : ''}`}
              onClick={handleShare}
              title={copied ? 'Link copied!' : 'Share catalog link'}
            >
              {copied ? <Check size={16} /> : <Share2 size={16} />}
              {copied ? 'Link Copied!' : 'Share'}
            </button>

            {onArchive && (
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => onArchive(gun)}
                title="Archive this hardware record"
              >
                <Archive size={16} /> Archive
              </button>
            )}

            {onEdit && (
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => onEdit(gun)}
              >
                Edit
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => onDelete(gun)}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <section className="detail-section">
        <h2>Description</h2>
        <p>{gun.description || 'No description available.'}</p>
      </section>

      {/* Specifications */}
      {gun.ingredients && gun.ingredients.length > 0 && (
        <section className="detail-section">
          <h2>Specifications</h2>
          <ul className="detail-specs">
            {gun.ingredients.map((ing, i) => (
              <li key={ing.id || i}>
                <strong>{ing.name}</strong> — {ing.quantity}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Assembly / Maintenance Steps */}
      {gun.steps && gun.steps.length > 0 && (
        <section className="detail-section">
          <h2>Assembly / Maintenance Steps</h2>
          <ol className="detail-steps">
            {gun.steps.map((step, i) => (
              <li key={step.id || i}>
                {step.instruction || step}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Reviews Section */}
      <section className="detail-section">
        <h2>Operator Reviews &amp; Feedback</h2>

        {/* Submit review */}
        <form className="review-form" onSubmit={handleSubmitReview}>
          <div className="review-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className="star-btn"
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
              >
                <Star
                  size={22}
                  fill={n <= rating ? 'var(--brass)' : 'none'}
                  stroke={n <= rating ? 'var(--brass)' : 'var(--steel)'}
                />
              </button>
            ))}
          </div>

          <textarea
            className="review-input"
            rows="3"
            placeholder="Write a field review or maintenance note…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
          />

          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting || !gun.id}
          >
            {submitting ? (
              <><Loader size={16} className="spin" /> Submitting…</>
            ) : (
              <><Send size={16} /> Submit Review</>
            )}
          </button>

          {reviewError && <p className="form-error">{reviewError}</p>}
          {reviewSuccess && <p className="form-success">{reviewSuccess}</p>}
          {!gun.id && (
            <p className="form-hint">
              Reviews require a server-generated product ID. This product is local-only.
            </p>
          )}
        </form>

        {/* Existing reviews list */}
        {reviewsLoading ? (
          <p className="detail-loading">Loading operator reviews…</p>
        ) : reviews.length > 0 ? (
          <ul className="review-list">
            {reviews.map((rev) => {
              // Check if user owns this review
              const isOwnReview =
                (rev.user_id && rev.user_id === currentUserId) ||
                (rev.user_identifier &&
                  (rev.user_identifier === currentUserId ||
                    rev.user_identifier === `Operator ${String(currentUserId).substring(0, 8)}`))

              const isEditingThis = editingReviewId === rev.id

              // Reaction data for other reviews
              const reactionData =
                optimisticReactions[rev.id] || getReviewReactionState(rev, currentUserId)

              return (
                <li key={rev.id} className={`review-item ${isOwnReview ? 'review-item--own' : ''}`}>
                  <div className="review-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="review-user">
                        {rev.user_identifier || 'Anonymous'}
                      </span>
                      {isOwnReview && (
                        <span className="review-badge-own">Your Review</span>
                      )}
                    </div>

                    {!isEditingThis && (
                      <span className="review-stars-display">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            size={14}
                            fill={i < rev.rating ? 'var(--brass)' : 'none'}
                            stroke={i < rev.rating ? 'var(--brass)' : 'var(--line)'}
                          />
                        ))}
                      </span>
                    )}
                  </div>

                  {/* Inline edit form for own review */}
                  {isEditingThis ? (
                    <div className="review-edit-box">
                      <div className="review-stars" style={{ marginBottom: '8px' }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className="star-btn"
                            onClick={() => setEditRating(n)}
                          >
                            <Star
                              size={18}
                              fill={n <= editRating ? 'var(--brass)' : 'none'}
                              stroke={n <= editRating ? 'var(--brass)' : 'var(--steel)'}
                            />
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="review-input"
                        rows="2"
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                        placeholder="Edit your review..."
                      />
                      {editError && <p className="form-error">{editError}</p>}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          disabled={updatingReview}
                          onClick={() => handleSaveEditReview(rev.id)}
                        >
                          <Save size={14} /> Save
                        </button>
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          onClick={handleCancelEditReview}
                        >
                          <X size={14} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {rev.comment && <p className="review-comment">{rev.comment}</p>}

                      {/* Footer actions: Edit/Delete for own, Like/Dislike for others */}
                      <div className="review-footer-actions">
                        {isOwnReview ? (
                          <div className="review-owner-tools">
                            <button
                              type="button"
                              className="review-act-btn"
                              onClick={() => handleStartEditReview(rev)}
                              title="Edit your review"
                            >
                              <Edit2 size={13} /> Edit
                            </button>
                            <button
                              type="button"
                              className="review-act-btn review-act-btn--danger"
                              disabled={deletingReview}
                              onClick={() => handleDeleteReview(rev.id)}
                              title="Delete your review"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        ) : (
                          <div className="review-reaction-group">
                            <button
                              type="button"
                              className={`review-vote-btn ${
                                reactionData.userReaction === 'like' ? 'review-vote-btn--active-like' : ''
                              }`}
                              onClick={() => handleToggleReaction(rev, 'like')}
                              title="Helpful review (Thumbs Up)"
                            >
                              <ThumbsUp size={13} />
                              <span>{reactionData.likes}</span>
                            </button>

                            <button
                              type="button"
                              className={`review-vote-btn ${
                                reactionData.userReaction === 'dislike' ? 'review-vote-btn--active-dislike' : ''
                              }`}
                              onClick={() => handleToggleReaction(rev, 'dislike')}
                              title="Unhelpful review (Thumbs Down)"
                            >
                              <ThumbsDown size={13} />
                              <span>{reactionData.dislikes}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="detail-empty">No reviews yet. Be the first to evaluate this piece.</p>
        )}
      </section>
    </div>
  )
}
