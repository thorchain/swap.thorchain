import { useState } from 'react'
import { Icon } from '@/components/icons'

interface CopyButtonProps {
  text: string
  delay?: number
}

export const CopyButton = ({ text, delay = 1000 }: CopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)

      setTimeout(() => setIsCopied(false), delay)
    } catch (err) {
      console.log('Failed to copy text: ', err)
      setIsCopied(false)
    }
  }

  return isCopied ? (
    <Icon name="check" className="text-thor-gray size-5 cursor-pointer" />
  ) : (
    <Icon name="copy" className="text-thor-gray size-5 cursor-pointer" onClick={handleCopy} />
  )
}
