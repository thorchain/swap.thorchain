import { Keplr } from '@keplr-wallet/types'
import { Eip6963Adapter } from './eip6963'
import { KeplrAdapter } from './keplr'

declare global {
  interface Window {
    station?: { keplr: Keplr }
  }
}

const provider = () => new KeplrAdapter(new Eip6963Adapter('station'), () => window.station?.keplr)
export default provider
