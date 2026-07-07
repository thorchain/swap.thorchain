import axios from 'axios'

const mayanode = axios.create({ baseURL: 'https://mayanode.mayachain.info' })
const mayaMidgard = axios.create({ baseURL: 'https://midgard.mayachain.info' })

export interface MayaNameAlias {
  chain: string
  address: string
}

export interface MayaName {
  name: string
  expire_block_height: number
  owner: string
  preferred_asset: string
  preferred_asset_swap_threshold_cacao?: string
  affiliate_collector_cacao?: string
  aliases: MayaNameAlias[]
}

// "Available" only when Mayanode reports the name doesn't exist; any other
// failure is unknown, not a free name.
const isNameNotFound = (err: unknown): boolean => {
  if (!axios.isAxiosError(err)) return false
  if (err.response?.status === 404) return true
  const message = err.response?.data?.message
  return typeof message === 'string' && message.includes("doesn't exist")
}

export const getMayaName = async (name: string): Promise<MayaName | null> => {
  try {
    const res = await mayanode.get(`/mayachain/mayaname/${encodeURIComponent(name)}`)
    // A 200 with a name means it's taken — registered (has `owner`) or a reserved
    // chain name (no `owner`). Either way, not registerable.
    return typeof res.data?.name === 'string' ? res.data : null
  } catch (err) {
    if (isNameNotFound(err)) return null
    throw err
  }
}

export const getMayaNamesOwned = async (address: string): Promise<string[]> => {
  try {
    const res = await mayaMidgard.get(`/v2/mayaname/owner/${address}`)
    return Array.isArray(res.data) ? res.data : []
  } catch {
    return []
  }
}

export interface MayaPool {
  asset: string
  status: string
}

export const getMayaPools = async (): Promise<MayaPool[]> => {
  return mayanode.get('/mayachain/pools').then(res => res.data)
}

export const getMayaLastBlock = async (): Promise<number> => {
  const data = await mayanode.get('/mayachain/lastblock').then(res => res.data)
  const first = Array.isArray(data) ? data[0] : data
  return first?.mayachain ?? 0
}
