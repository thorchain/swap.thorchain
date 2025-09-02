import { translateError } from 'rujira.js'
import { OctagonAlert } from 'lucide-react'

export const SwapWarning = ({ error }: { error?: string }) => {
  if (error) {
    return (
      <div className="mt-2 flex items-center gap-2 px-5 text-red-500">
        <OctagonAlert size={16} min={16} className="flex-shrink-0" />
        <span className="overflow-hidden">{translateError(error || 'Unknown Error')}</span>
      </div>
    )
  }

  return null
}
