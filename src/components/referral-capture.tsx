'use client'

import { useEffect } from 'react'
import { captureReferral } from '@/lib/referral'

// Records a KOL link click once per page load and stores the code for later quotes.
export function ReferralCapture() {
  useEffect(() => {
    void captureReferral()
  }, [])

  return null
}
