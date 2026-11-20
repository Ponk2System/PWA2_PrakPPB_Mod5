// ---------------------------------------------------------------------------
// reviewReactions.js — Real-time reaction state management.
// Tracks authentic likes and dislikes without artificial dummy values.
// ---------------------------------------------------------------------------

const REACTIONS_KEY = 'bore_barrel_review_reactions_v2'

/**
 * Read local reaction cache.
 * @returns {Record<string, { likes: number, dislikes: number, userReaction: 'like'|'dislike'|null }>}
 */
export const getAllLocalReactions = () => {
  try {
    const raw = localStorage.getItem(REACTIONS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/**
 * Determine the reaction state for a review.
 * Prioritizes live data from Supabase (`rev.reactions`), falling back to local cache or 0.
 *
 * @param {Object} rev - The review object from API
 * @param {string} currentUserId - The active user's UUID
 * @returns {{ likes: number, dislikes: number, userReaction: 'like'|'dislike'|null }}
 */
export const getReviewReactionState = (rev, currentUserId) => {
  if (!rev || !rev.id) {
    return { likes: 0, dislikes: 0, userReaction: null }
  }

  const reviewId = String(rev.id)
  const localCache = getAllLocalReactions()

  // Base state from Supabase data if present
  let baseLikes = 0
  let baseDislikes = 0
  let baseReaction = null

  if (rev.reactions && typeof rev.reactions === 'object') {
    const likesList = Array.isArray(rev.reactions.likes) ? rev.reactions.likes : []
    const dislikesList = Array.isArray(rev.reactions.dislikes) ? rev.reactions.dislikes : []

    baseLikes = likesList.length
    baseDislikes = dislikesList.length

    if (currentUserId) {
      if (likesList.includes(currentUserId)) {
        baseReaction = 'like'
      } else if (dislikesList.includes(currentUserId)) {
        baseReaction = 'dislike'
      }
    }
  }

  // If local cache has a newer reaction by this device, respect it
  if (localCache[reviewId] && localCache[reviewId].userReaction !== undefined) {
    return localCache[reviewId]
  }

  return {
    likes: baseLikes,
    dislikes: baseDislikes,
    userReaction: baseReaction,
  }
}

/**
 * Compute the next reaction state when a user clicks Like or Dislike.
 *
 * @param {string|number} reviewId
 * @param {string} currentUserId
 * @param {'like'|'dislike'} type
 * @param {{ likes: number, dislikes: number, userReaction: 'like'|'dislike'|null }} current
 * @returns {{ likes: number, dislikes: number, userReaction: 'like'|'dislike'|null }}
 */
export const calculateNextReaction = (reviewId, currentUserId, type, current) => {
  const curLikes = current?.likes || 0
  const curDislikes = current?.dislikes || 0
  const curReaction = current?.userReaction || null

  let nextLikes = curLikes
  let nextDislikes = curDislikes
  let nextReaction = null

  if (curReaction === type) {
    // Untoggle
    if (type === 'like') nextLikes = Math.max(0, nextLikes - 1)
    if (type === 'dislike') nextDislikes = Math.max(0, nextDislikes - 1)
    nextReaction = null
  } else {
    // Switching or initial vote
    if (curReaction === 'like') nextLikes = Math.max(0, nextLikes - 1)
    if (curReaction === 'dislike') nextDislikes = Math.max(0, nextDislikes - 1)

    if (type === 'like') nextLikes += 1
    if (type === 'dislike') nextDislikes += 1
    nextReaction = type
  }

  const result = {
    likes: nextLikes,
    dislikes: nextDislikes,
    userReaction: nextReaction,
  }

  // Persist locally for immediate persistence
  try {
    const all = getAllLocalReactions()
    all[String(reviewId)] = result
    localStorage.setItem(REACTIONS_KEY, JSON.stringify(all))
  } catch (err) {
    console.warn('Could not save local reaction cache:', err)
  }

  return result
}
