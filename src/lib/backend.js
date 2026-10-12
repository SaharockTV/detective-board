import { createLocalBackend } from './localBackend'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const CLOUD = !!(URL && KEY)
let backendPromise

/**
 * Единый интерфейс хранилища:
 *  createBoard(board) / getBoardByCode(code)
 *  listRows(boardId) / putRow(row)          row = { id, board_id, kind, data, updated_at }
 *  join(boardId, presence, { onRow, onEph, onPresence }) → { send(evt), track(state), leave() }
 *  upload(boardId, file) → media
 *  fileUrl(url) → Promise<string>
 */
export function getBackend() {
  if (!backendPromise) {
    backendPromise = CLOUD
      ? import('./supabaseBackend').then(m => m.createSupabaseBackend(URL, KEY))
      : Promise.resolve(createLocalBackend())
  }
  return backendPromise
}