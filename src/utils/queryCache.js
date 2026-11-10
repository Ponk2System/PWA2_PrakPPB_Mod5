// ---------------------------------------------------------------------------
// queryCache.js — In-memory query caching store with TTL support.
// Used by useGuns and gunService to cache catalog responses and invalidate
// them automatically on product mutations.
// ---------------------------------------------------------------------------

const gunsCache = new Map()
const singleGunCache = new Map()
export const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes TTL

export function getCachedGuns(key) {
  if (!gunsCache.has(key)) return null
  const entry = gunsCache.get(key)
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    gunsCache.delete(key)
    return null
  }
  return entry
}

export function setCachedGuns(key, data, pagination) {
  gunsCache.set(key, {
    data,
    pagination,
    timestamp: Date.now(),
  })
}

export function getCachedGunById(id) {
  if (!singleGunCache.has(id)) return null
  const entry = singleGunCache.get(id)
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    singleGunCache.delete(id)
    return null
  }
  return entry.data
}

export function setCachedGunById(id, data) {
  singleGunCache.set(id, {
    data,
    timestamp: Date.now(),
  })
}

export function invalidateGunsCache() {
  gunsCache.clear()
  singleGunCache.clear()
}

