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

// Mayanode returns 404 for an unregistered name — surface that as `null` (available).
export const getMayaName = async (name: string): Promise<MayaName | null> => {
  try {
    const res = await mayanode.get(`/mayachain/mayaname/${encodeURIComponent(name)}`)
    // Treat anything without a real owner as "not found".
    return typeof res.data?.owner === 'string' ? res.data : null
  } catch {
    return null
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

export const getMayaLastBlock = async (): Promise<number> => {
  const data = await mayanode.get('/mayachain/lastblock').then(res => res.data)
  const first = Array.isArray(data) ? data[0] : data
  return first?.mayachain ?? 0
}
