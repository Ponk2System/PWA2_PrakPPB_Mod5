import { useState, useEffect, useCallback } from 'react'
import gunService from '../services/gunService'
import {
  getCachedGuns,
  setCachedGuns,
  getCachedGunById,
  setCachedGunById,
  invalidateGunsCache,
} from '../utils/queryCache'

export { invalidateGunsCache }

// ---------------------------------------------------------------------------
// useGuns — fetch the paginated / filtered product list from the API with caching.
//
// Returns { guns, loading, error, pagination, refetch }.
// ---------------------------------------------------------------------------
export function useGuns(params = {}) {
  const [guns, setGuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState(null)

  // Serialise params so the effect re-runs when they change.
  const paramKey = JSON.stringify(params)

  const fetchGuns = useCallback(async (options = {}) => {
    const force = options?.force === true

    // Check cache first if not forced
    if (!force) {
      const cached = getCachedGuns(paramKey)
      if (cached) {
        setGuns(cached.data || [])
        setPagination(cached.pagination || null)
        setError(null)
        setLoading(false)
        return
      }
    }

    try {
      setLoading(true)
      setError(null)

      const response = await gunService.getGuns(params)

      if (response.success) {
        const data = response.data || []
        const pageInfo = response.pagination || null
        setGuns(data)
        setPagination(pageInfo)
        setCachedGuns(paramKey, data, pageInfo)
      } else {
        setError(response.message || 'Failed to fetch products.')
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching products.')
      setGuns([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey])

  useEffect(() => {
    fetchGuns()
  }, [fetchGuns])

  const refetch = useCallback(() => fetchGuns({ force: true }), [fetchGuns])

  return { guns, loading, error, pagination, refetch }
}

// ---------------------------------------------------------------------------
// useGunById — fetch a single product by its UUID with caching.
//
// Returns { gun, loading, error, refetch }.
// ---------------------------------------------------------------------------
export function useGunById(id) {
  const [gun, setGun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchGun = useCallback(async (options = {}) => {
    if (!id) {
      setLoading(false)
      return
    }

    const force = options?.force === true
    if (!force) {
      const cached = getCachedGunById(id)
      if (cached) {
        setGun(cached)
        setError(null)
        setLoading(false)
        return
      }
    }

    try {
      setLoading(true)
      setError(null)

      const response = await gunService.getGunById(id)

      if (response.success) {
        setGun(response.data)
        setCachedGunById(id, response.data)
      } else {
        setError(response.message || 'Product not found.')
      }
    } catch (err) {
      setError(err.message || 'Failed to load product details.')
      setGun(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchGun()
  }, [fetchGun])

  const refetch = useCallback(() => fetchGun({ force: true }), [fetchGun])

  return { gun, loading, error, refetch }
}

