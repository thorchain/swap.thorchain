import { Eip6963Adapter } from './eips/eip6963'

const provider = () => new Eip6963Adapter('metamask')
export default provider
