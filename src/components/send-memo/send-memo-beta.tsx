import { AlertTriangle } from 'lucide-react'

export function SendMemoBeta() {
  return (
    <div className="border-jacob flex items-center gap-3 rounded-xl border p-4">
      <AlertTriangle className="text-jacob mt-0.5 size-5 shrink-0" />
      <div className="space-y-1 text-sm">
        <p className="text-txt-high-contrast font-semibold">This is a beta feature</p>
        <p className="text-txt-label-small">There may be undiscovered bugs. Use at your own risk!</p>
      </div>
    </div>
  )
}
