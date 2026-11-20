// ---------------------------------------------------------------------------
// reviewReactions.js — Local storage reaction system for community reviews.
// Allows users to like (thumbs up) or dislike (thumbs down) reviews from others.
// ---------------------------------------------------------------------------

const REACTIONS_KEY = 'bore_barrel_review_reactions'

/**
 * Read all reaction records.
 * @returns {Record<string, { likes: number, dislikes: number, userReaction: 'like'|'dislike'|null }>}
 */
export const getAllReactions = () => {
  try {
    const raw = localStorage.getItem(REACTIONS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/**
 * Get reaction state for a specific review ID.
 * Seed pseudo-random baseline counts so existing reviews look active.
 */
export const getReviewReactions = (reviewId) => {
  if (!reviewId) return { likes: 0, dislikes: 0, userReaction: null }

  const all = getAllReactions()
  const key = String(reviewId)

  if (all[key]) {
    return all[key]
  }

  // Generate stable baseline likes based on hash of reviewId
  let seed = 0
  for (let i = 0; i < key.length; i++) {
    seed = (seed + key.charCodeAt(i) * (i + 1)) % 17
  }
  const defaultLikes = (seed % 9) + 1
  const defaultDislikes = seed % 3

  const entry = {
    likes: defaultLikes,
    dislikes: defaultDislikes,
    userReaction: null,
  }

  all[key] = entry
  try {
    localStorage.setItem(REACTIONS_KEY, JSON.stringify(all))
  } catch (err) {
    console.warn('Could not store reactions:', err)
  }

  return entry
}

/**
 * Toggle like or dislike on a review.
 * @param {string|number} reviewId
 * @param {'like'|'dislike'} type
 * @returns {{ likes: number, dislikes: number, userReaction: 'like'|'dislike'|null }}
 */
export const toggleReaction = (reviewId, type) => {
  if (!reviewId || (type !== 'like' && type !== 'dislike')) {
    return { likes: 0, dislikes: 0, userReaction: null }
  }

  const all = getAllReactions()
  const key = String(reviewId)
  const current = getReviewReactions(reviewId)

  let likes = current.likes || 0
  let dislikes = current.dislikes || 0
  let newReaction = null

  if (current.userReaction === type) {
    // Untoggle
    if (type === 'like') likes = Math.max(0, likes - 1)
    if (type === 'dislike') dislikes = Math.max(0, dislikes - 1)
    newReaction = null
  } else {
    // Switching or new vote
    if (current.userReaction === 'like') likes = Math.max(0, likes - 1)
    if (current.userReaction === 'dislike') dislikes = Math.max(0, dislikes - 1)

    if (type === 'like') likes += 1
    if (type === 'dislike') dislikes += 1
    newReaction = type
  }

  const updated = {
    likes,
    dislikes,
    userReaction: newReaction,
  }

  all[key] = updated
  try {
    localStorage.setItem(REACTIONS_KEY, JSON.stringify(all))
  } catch (err) {
    console.warn('Could not store reaction:', err)
  }

  return updated
}
