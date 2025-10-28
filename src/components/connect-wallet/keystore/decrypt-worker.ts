import { decryptFromKeystore, Keystore } from '@swapkit/wallets/keystore'

interface DecryptMessage {
  keystoreData: Keystore
  password: string
}

interface DecryptResponse {
  success: boolean
  phrase?: string
  error?: Error
}

self.onmessage = async function (e: MessageEvent<DecryptMessage>) {
  const { keystoreData, password } = e.data

  try {
    const phrase = await decryptFromKeystore(keystoreData, password)
    self.postMessage({ success: true, phrase } as DecryptResponse)
  } catch (error) {
    self.postMessage({
      success: false,
      error: error
    } as DecryptResponse)
  }
}
