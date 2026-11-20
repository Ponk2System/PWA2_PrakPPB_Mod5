import { apiClient, IS_SUPABASE } from '../config/api'

// ---------------------------------------------------------------------------
// Helpers — Parse reactions metadata encoded in review comments.
// Ensures reaction counts and votes are persistent across devices in Supabase.
// ---------------------------------------------------------------------------
export const parseCommentAndReactions = (rawComment) => {
  if (!rawComment || typeof rawComment !== 'string') {
    return { cleanComment: '', reactions: { likes: [], dislikes: [] } }
  }
  const regex = /\n?_reactions:(\{.*\})$/
  const match = rawComment.match(regex)
  if (match) {
    try {
      const parsed = JSON.parse(match[1])
      const likes = Array.isArray(parsed.likes) ? parsed.likes : []
      const dislikes = Array.isArray(parsed.dislikes) ? parsed.dislikes : []
      const cleanComment = rawComment.replace(regex, '').trim()
      return { cleanComment, reactions: { likes, dislikes } }
    } catch {
      // ignore JSON parse error
    }
  }
  return { cleanComment: rawComment, reactions: { likes: [], dislikes: [] } }
}

// ---------------------------------------------------------------------------
// ReviewService — product reviews & ratings.
// Supports both Supabase (public.reviews) and university API (/api/v1/recipes/:id/reviews).
// ---------------------------------------------------------------------------
class ReviewService {
  /**
   * Fetch all reviews for a given product with parsed reactions and user_id.
   */
  async getReviews(gunId) {
    if (IS_SUPABASE) {
      const data = await apiClient.get(
        `/rest/v1/reviews?product_id=eq.${gunId}&select=*&order=created_at.desc`,
      )
      const list = Array.isArray(data)
        ? data.map((r) => {
            const { cleanComment, reactions } = parseCommentAndReactions(r.comment)
            return {
              id: r.id,
              product_id: r.product_id,
              user_id: r.user_id,
              user_identifier: r.user_id ? `Operator ${String(r.user_id).substring(0, 8)}` : 'Anonymous',
              rating: r.rating,
              comment: cleanComment,
              raw_comment: r.comment || '',
              reactions, // { likes: string[], dislikes: string[] }
              created_at: r.created_at,
            }
          })
        : []

      return { success: true, data: list }
    }

    return apiClient.get(`/api/v1/recipes/${gunId}/reviews`)
  }

  /**
   * Submit a new review.
   * @param {string|number} gunId
   * @param {Object} reviewData  { user_identifier, user_id, rating, comment }
   */
  async createReview(gunId, reviewData) {
    if (IS_SUPABASE) {
      const payload = {
        product_id: Number(gunId),
        user_id: reviewData.user_id || reviewData.user_identifier,
        rating: Number(reviewData.rating),
        comment: (reviewData.comment || '').trim(),
      }

      const res = await apiClient.post('/rest/v1/reviews', payload, {
        headers: { Prefer: 'return=representation' },
      })
      const created = Array.isArray(res) ? res[0] : res
      return { success: true, data: created }
    }

    return apiClient.post(`/api/v1/recipes/${gunId}/reviews`, reviewData)
  }

  /**
   * Edit an existing review. Preserves reaction metadata if present.
   */
  async updateReview(reviewId, reviewData) {
    if (IS_SUPABASE) {
      let finalComment = (reviewData.comment || '').trim()

      // If existing review had reactions metadata, re-attach it to the updated comment
      if (reviewData.raw_comment) {
        const { reactions } = parseCommentAndReactions(reviewData.raw_comment)
        if (reactions.likes.length > 0 || reactions.dislikes.length > 0) {
          finalComment = `${finalComment}\n_reactions:${JSON.stringify(reactions)}`
        }
      }

      const res = await apiClient.patch(
        `/rest/v1/reviews?id=eq.${reviewId}`,
        {
          rating: Number(reviewData.rating),
          comment: finalComment,
        },
        { headers: { Prefer: 'return=representation' } },
      )
      return { success: true, data: Array.isArray(res) ? res[0] : res }
    }

    return apiClient.put(`/api/v1/recipes/${reviewId}`, reviewData)
  }

  /**
   * Delete a review.
   */
  async deleteReview(reviewId) {
    if (IS_SUPABASE) {
      await apiClient.delete(`/rest/v1/reviews?id=eq.${reviewId}`)
      return { success: true }
    }

    return apiClient.delete(`/api/v1/recipes/${reviewId}`)
  }

  /**
   * Toggle a like or dislike reaction on a review in Supabase.
   * @param {number|string} reviewId
   * @param {string} userId - User identifier
   * @param {'like'|'dislike'} type - Reaction type
   */
  async toggleReaction(reviewId, userId, type) {
    if (!reviewId || !userId || (type !== 'like' && type !== 'dislike')) return null

    if (IS_SUPABASE) {
      try {
        const rows = await apiClient.get(`/rest/v1/reviews?id=eq.${reviewId}&select=*`)
        const current = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
        if (!current) return null

        const { cleanComment, reactions } = parseCommentAndReactions(current.comment)
        const likes = new Set(reactions.likes || [])
        const dislikes = new Set(reactions.dislikes || [])

        if (type === 'like') {
          if (likes.has(userId)) {
            likes.delete(userId)
          } else {
            likes.add(userId)
            dislikes.delete(userId)
          }
        } else if (type === 'dislike') {
          if (dislikes.has(userId)) {
            dislikes.delete(userId)
          } else {
            dislikes.add(userId)
            likes.delete(userId)
          }
        }

        const newReactions = {
          likes: Array.from(likes),
          dislikes: Array.from(dislikes),
        }

        const updatedComment = `${cleanComment}\n_reactions:${JSON.stringify(newReactions)}`

        await apiClient.patch(
          `/rest/v1/reviews?id=eq.${reviewId}`,
          { comment: updatedComment },
          { headers: { Prefer: 'return=representation' } },
        )

        return newReactions
      } catch (err) {
        console.warn('Failed to sync reaction with Supabase:', err)
        return null
      }
    }
    return null
  }
}

export default new ReviewService()
