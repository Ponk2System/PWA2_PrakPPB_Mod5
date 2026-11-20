// ---------------------------------------------------------------------------
// archiveStorage.js — Manages catalog hardware archive persistence.
// Allows archiving products, restoring them, or permanently deleting them.
// ---------------------------------------------------------------------------

const ARCHIVE_KEY = 'bore_barrel_archived_guns'
export const ARCHIVE_EVENT = 'bore_barrel_archive_updated'

export const getArchivedGuns = () => {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const isGunArchived = (gunId) => {
  if (!gunId) return false
  const list = getArchivedGuns()
  return list.some((g) => String(g.id) === String(gunId))
}

export const archiveGun = (gun) => {
  if (!gun || !gun.id) return false
  const list = getArchivedGuns()
  const exists = list.some((g) => String(g.id) === String(gun.id))
  if (!exists) {
    list.unshift({
      ...gun,
      archivedAt: new Date().toISOString(),
    })
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list))
    window.dispatchEvent(new CustomEvent(ARCHIVE_EVENT))
  }
  return true
}

export const restoreGun = (gunId) => {
  const list = getArchivedGuns().filter((g) => String(g.id) !== String(gunId))
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list))
  window.dispatchEvent(new CustomEvent(ARCHIVE_EVENT))
  return true
}

export const deleteArchivedGunPermanently = (gunId) => {
  restoreGun(gunId)
  return true
}
