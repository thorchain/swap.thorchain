import BD from 'country-flag-icons/react/3x2/BD'
import CN from 'country-flag-icons/react/3x2/CN'
import DE from 'country-flag-icons/react/3x2/DE'
import EG from 'country-flag-icons/react/3x2/EG'
import ES from 'country-flag-icons/react/3x2/ES'
import FR from 'country-flag-icons/react/3x2/FR'
import ID from 'country-flag-icons/react/3x2/ID'
import IN from 'country-flag-icons/react/3x2/IN'
import IR from 'country-flag-icons/react/3x2/IR'
import IT from 'country-flag-icons/react/3x2/IT'
import JP from 'country-flag-icons/react/3x2/JP'
import KR from 'country-flag-icons/react/3x2/KR'
import NG from 'country-flag-icons/react/3x2/NG'
import PK from 'country-flag-icons/react/3x2/PK'
import PT from 'country-flag-icons/react/3x2/PT'
import RU from 'country-flag-icons/react/3x2/RU'
import SA from 'country-flag-icons/react/3x2/SA'
import TH from 'country-flag-icons/react/3x2/TH'
import TR from 'country-flag-icons/react/3x2/TR'
import TW from 'country-flag-icons/react/3x2/TW'
import US from 'country-flag-icons/react/3x2/US'
import VN from 'country-flag-icons/react/3x2/VN'
import Image from 'next/image'
import { localeCountries, localeFlags, type Locale } from '@/i18n/config'
import { cn } from '@/lib/utils'

// Only the flags referenced by localeCountries are imported, one per subpath,
// so the bundle ships just these instead of the library's full flag set.
const flags = { BD, CN, DE, EG, ES, FR, ID, IN, IR, IT, JP, KR, NG, PK, PT, RU, SA, TH, TR, TW, US, VN }

// SVG flag for a locale, replacing the previous emoji flags. Fixed 3:2 ratio
// keeps every flag the same width so the switcher rows stay aligned.
export const LocaleFlag = ({ locale, className }: { locale: Locale; className?: string }) => {
  const size = cn('h-3 w-4.5 shrink-0 rounded-xs', className)

  const custom = localeFlags[locale]
  if (custom) return <Image src={custom} alt={locale} title={locale} width={18} height={12} className={cn(size, 'object-cover')} />

  const Flag = flags[localeCountries[locale] as keyof typeof flags]
  if (!Flag) return null
  return <Flag title={locale} className={size} />
}
