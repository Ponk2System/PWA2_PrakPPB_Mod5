import { apiClient, IS_SUPABASE } from '../config/api'
import { invalidateGunsCache } from '../utils/queryCache'

// ---------------------------------------------------------------------------
// Normalizer — standardizes product shape whether received from Supabase
// (public.products) or from the university API (/api/v1/recipes).
// Supports multi-image preservation and extraction.
// ---------------------------------------------------------------------------
export const normalizeProduct = (item) => {
  if (!item) return null

  // Resolve multiple images
  let imagesList = []
  if (Array.isArray(item.images) && item.images.length > 0) {
    imagesList = item.images.filter(Boolean)
  }

  // Resolve specifications from Supabase `specs` (text array) or API `ingredients`
  let specsList = []
  if (Array.isArray(item.specs)) {
    specsList = item.specs
      .map((s, idx) => {
        if (typeof s === 'string') {
          // If stored meta for images
          if (s.startsWith('_images:')) {
            try {
              const parsed = JSON.parse(s.slice(8))
              if (Array.isArray(parsed)) {
                imagesList = [...new Set([...imagesList, ...parsed])]
              }
            } catch {
              // ignore
            }
            return null
          }

          const colonIndex = s.indexOf(':')
          if (colonIndex > -1) {
            return {
              id: `spec-${idx}`,
              name: s.substring(0, colonIndex).trim(),
              quantity: s.substring(colonIndex + 1).trim(),
            }
          }
          return {
            id: `spec-${idx}`,
            name: 'Specification',
            quantity: s.trim(),
          }
        }
        return s
      })
      .filter(Boolean)
  } else if (Array.isArray(item.ingredients)) {
    specsList = item.ingredients
  }

  // Check localStorage cache for multi-images fallback
  if (imagesList.length === 0 && item.id) {
    try {
      const cached = localStorage.getItem(`gun_images_${item.id}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed)) imagesList = parsed
      }
    } catch {
      // ignore
    }
  }

  const primaryImage = item.image_url || item.image || (imagesList.length > 0 ? imagesList[0] : '/guns/pistol.svg')
  if (imagesList.length === 0) {
    imagesList = [primaryImage]
  } else if (!imagesList.includes(primaryImage)) {
    imagesList.unshift(primaryImage)
  }

  // Resolve steps
  const stepsList =
    Array.isArray(item.steps) && item.steps.length > 0
      ? item.steps
      : ['Verify firearm is completely unloaded and point in safe direction.', 'Inspect receiver and mechanism for maintenance.']

  return {
    ...item,
    id: item.id,
    name: item.name || 'Hardware Piece',
    type: item.type || item.category || 'Hardware',
    category: item.type || item.category || 'Hardware',
    caliber: item.caliber || 'Standard',
    price: Number(item.price ?? item.cook_time ?? 0),
    description: item.description || '',
    image_url: primaryImage,
    image: primaryImage,
    images: imagesList,
    ingredients: specsList,
    steps: stepsList,
  }
}

// ---------------------------------------------------------------------------
// GunService — wraps backend CRUD endpoints.
// Supports both Supabase PostgREST table (/rest/v1/products) and
// standard REST API (/api/v1/recipes).
// ---------------------------------------------------------------------------
class GunService {
  /**
   * Fetch a paginated, filterable list of products.
   */
  async getGuns(params = {}) {
    if (IS_SUPABASE) {
      const queryParts = ['select=*']

      if (params.search) {
        queryParts.push(`name=ilike.*${encodeURIComponent(params.search)}*`)
      }

      if (params.category && params.category !== 'All') {
        queryParts.push(`type=eq.${encodeURIComponent(params.category)}`)
      }

      if (params.sort_by) {
        const order = params.order === 'desc' ? 'desc' : 'asc'
        queryParts.push(`order=${encodeURIComponent(params.sort_by)}.${order}`)
      } else {
        queryParts.push('order=created_at.desc')
      }

      if (params.limit) {
        queryParts.push(`limit=${params.limit}`)
      }

      const queryString = queryParts.join('&')
      const data = await apiClient.get(`/rest/v1/products?${queryString}`)
      const list = Array.isArray(data) ? data.map(normalizeProduct) : []

      return {
        success: true,
        data: list,
        pagination: {
          total: list.length,
          page: params.page || 1,
          limit: params.limit || 50,
        },
      }
    }

    // Fallback: university REST API
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    )
    return apiClient.get('/api/v1/recipes', { params: clean })
  }

  /**
   * Fetch a single product by ID.
   */
  async getGunById(id) {
    if (IS_SUPABASE) {
      const data = await apiClient.get(`/rest/v1/products?id=eq.${id}&select=*`)
      if (Array.isArray(data) && data.length > 0) {
        return { success: true, data: normalizeProduct(data[0]) }
      }
      throw new Error('Hardware item not found.')
    }
    return apiClient.get(`/api/v1/recipes/${id}`)
  }

  /**
   * Create a new product.
   */
  async createGun(data) {
    invalidateGunsCache()
    const imagesArray = Array.isArray(data.images) && data.images.length > 0
      ? data.images
      : data.image_url
      ? [data.image_url]
      : []

    if (IS_SUPABASE) {
      const specsArray = Array.isArray(data.ingredients)
        ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`)
        : Array.isArray(data.specs)
        ? data.specs.slice()
        : []

      if (imagesArray.length > 0) {
        specsArray.push(`_images:${JSON.stringify(imagesArray)}`)
      }

      const payload = {
        name: data.name,
        type: data.type || (data.category === 'minuman' ? 'Rifle' : 'Pistol'),
        caliber: data.caliber || '9mm',
        price: Number(data.price ?? data.cook_time ?? 0),
        description: data.description || '',
        specs: specsArray,
        image_url: imagesArray[0] || data.image_url || null,
      }

      const res = await apiClient.post('/rest/v1/products', payload, {
        headers: { Prefer: 'return=representation' },
      })
      const created = Array.isArray(res) ? res[0] : res
      if (created?.id && imagesArray.length > 0) {
        try {
          localStorage.setItem(`gun_images_${created.id}`, JSON.stringify(imagesArray))
        } catch {
          // ignore
        }
      }
      return { success: true, data: normalizeProduct(created) }
    }

    const res = await apiClient.post('/api/v1/recipes', data)
    if (res?.data?.id && imagesArray.length > 0) {
      try {
        localStorage.setItem(`gun_images_${res.data.id}`, JSON.stringify(imagesArray))
      } catch {
        // ignore
      }
    }
    return res
  }

  /**
   * Update existing product.
   */
  async updateGun(id, data) {
    invalidateGunsCache()
    const imagesArray = Array.isArray(data.images) && data.images.length > 0
      ? data.images
      : data.image_url
      ? [data.image_url]
      : null

    if (imagesArray && id) {
      try {
        localStorage.setItem(`gun_images_${id}`, JSON.stringify(imagesArray))
      } catch {
        // ignore
      }
    }

    if (IS_SUPABASE) {
      let specsArray = Array.isArray(data.ingredients)
        ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`)
        : Array.isArray(data.specs)
        ? data.specs.filter((s) => typeof s !== 'string' || !s.startsWith('_images:'))
        : undefined

      if (specsArray !== undefined && imagesArray) {
        specsArray.push(`_images:${JSON.stringify(imagesArray)}`)
      }

      const payload = {
        updated_at: new Date().toISOString(),
      }
      if (data.name !== undefined) payload.name = data.name
      if (data.type !== undefined) payload.type = data.type
      if (data.caliber !== undefined) payload.caliber = data.caliber
      if (data.price !== undefined || data.cook_time !== undefined) {
        payload.price = Number(data.price ?? data.cook_time ?? 0)
      }
      if (data.description !== undefined) payload.description = data.description
      if (specsArray !== undefined) payload.specs = specsArray
      if (imagesArray && imagesArray.length > 0) {
        payload.image_url = imagesArray[0]
      } else if (data.image_url !== undefined) {
        payload.image_url = data.image_url
      }

      const res = await apiClient.patch(`/rest/v1/products?id=eq.${id}`, payload, {
        headers: { Prefer: 'return=representation' },
      })
      const updated = Array.isArray(res) ? res[0] : res
      return { success: true, data: normalizeProduct(updated) }
    }
    return apiClient.put(`/api/v1/recipes/${id}`, data)
  }

  /**
   * Partial update (PATCH).
   */
  async patchGun(id, data) {
    invalidateGunsCache()
    if (IS_SUPABASE) {
      return this.updateGun(id, data)
    }
    return apiClient.patch(`/api/v1/recipes/${id}`, data)
  }

  /**
   * Delete product.
   */
  async deleteGun(id) {
    invalidateGunsCache()
    try {
      localStorage.removeItem(`gun_images_${id}`)
    } catch {
      // ignore
    }
    if (IS_SUPABASE) {
      await apiClient.delete(`/rest/v1/products?id=eq.${id}`)
      return { success: true }
    }
    return apiClient.delete(`/api/v1/recipes/${id}`)
  }
}

export default new GunService()
