import { useState } from 'react'
import { Copy, CopyCheck } from 'lucide-react'

interface CopyButtonProps {
  text: string
  className?: string
  delay?: number
}

export const CopyButton = ({ className, text, delay = 1000 }: CopyButtonProps) => {
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
    <CopyCheck size={14} className={className} />
  ) : (
    <Copy size={14} className={className} onClick={handleCopy} />
  )
}
