import { OctagonAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export const SwapBetaAlert = () => {
  return (
    <Alert className="bg-lawrence mb-4 flex items-center justify-between rounded-4xl border-0 p-4 text-[#8257FD]">
      <div className="flex items-center gap-3">
        <OctagonAlert className="" size={24} min={24} />
        <div>
          <AlertTitle className="text-leah font-semibold">This is a beta test site</AlertTitle>
          <AlertDescription className="text-xs">The official URL will be swap.thorchain.org</AlertDescription>
        </div>
      </div>
      <Button className="text-leah rounded-3xl border-0 text-xs font-semibold" variant="outline">
        <a href="https://gitlab.com/thorchain/client/ui/-/issues" rel="noopener noreferrer" target="_blank">
          Report Bug
        </a>
      </Button>
    </Alert>
  )
}
