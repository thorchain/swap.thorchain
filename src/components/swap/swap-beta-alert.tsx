import { Alert } from '@/components/ui/alert'
import { Icon } from '@/components/icons'

export const SwapBetaAlert = () => {
  return (
    <Alert className="bg-lawrence mb-4 flex rounded-4xl border-0 p-4">
      <div className="flex items-center gap-3">
        <Icon name="warning" className="text-storm-purple size-6 shrink-0" />
        <span className="text-thor-gray text-xs">
          This is a new site. Report bugs to &nbsp;
          <a href="mailto:swap@horizontalsystems.io" className="text-runes-blue hover:text-runes-blue/90">
            swap@horizontalsystems.io
          </a>
        </span>
      </div>
    </Alert>
  )
}
