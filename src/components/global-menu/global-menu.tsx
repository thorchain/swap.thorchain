'use client'

import Image from 'next/image'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import Lottie, { LottieRefCurrentProps } from 'lottie-react'
import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Dialog, DialogPortal } from '@/components/ui/dialog'
import { HeaderLogoText } from '@/components/header/header-logo-text'
import { AppConfig, PRIMARY_HOST, SUBDOMAIN_ROUTES } from '@/config'
import { bondAnim, memoAnim, nodeAnim, poolsAnim, swapAnim, tcyAnim, thornameAnim } from './animations'

const SOCIAL_LINKS = [
  {
    label: 'X (Twitter)',
    href: 'https://x.com/thorchain',
    icon: `<svg width="20" height="19" viewBox="0 0 20 19" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15.8014 0H18.867L12.136 8.06273L20 19H13.8287L8.997 12.3535L3.46551 19H0.399867L7.53082 10.3764L0 0H6.32456L10.6898 6.07159L15.8014 0ZM14.7284 17.107H16.4279L5.43152 1.82288H3.60546L14.7284 17.107Z" fill="#FAFAFA"/></svg>`
  },
  {
    label: 'Telegram',
    href: 'https://t.me/thorchain_org',
    icon: `<svg width="20" height="16" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18.6339 0.0653823L0.520771 6.77709C0.509994 6.78106 0.499547 6.78582 0.48952 6.7913C0.34264 6.87098 -0.682396 7.47134 0.762967 8.00961L0.777811 8.01484L5.09085 9.3491C5.12376 9.35934 5.1586 9.36257 5.19295 9.35856C5.22729 9.35456 5.26031 9.34341 5.28969 9.32591L15.9873 2.93477C16.0135 2.9191 16.0428 2.90855 16.0733 2.90373C16.2221 2.88016 16.6506 2.83602 16.3795 3.16557C16.0729 3.53962 8.76598 9.80957 7.95501 10.5049C7.90825 10.5451 7.87932 10.601 7.87415 10.6609L7.52023 14.7007C7.52019 14.7419 7.53015 14.7825 7.54934 14.8193C7.56853 14.8561 7.59642 14.8881 7.63078 14.9128C7.67955 14.9422 7.73689 14.9559 7.79436 14.9517C7.85182 14.9475 7.90636 14.9258 7.94993 14.8896L10.5125 12.6965C10.553 12.6619 10.6046 12.6416 10.6589 12.6389C10.7131 12.6363 10.7666 12.6515 10.8106 12.682L15.2814 15.7904L15.2959 15.7997C15.4041 15.8637 16.5729 16.5149 16.9104 15.0606L19.9964 1.00913C20.0007 0.964615 20.0425 0.475349 19.6773 0.186203C19.2937 -0.116035 18.7507 0.0365798 18.6691 0.0530383C18.657 0.0562485 18.6453 0.0603764 18.6339 0.0653823Z" fill="#FAFAFA"/></svg>`
  },
  {
    label: 'Discord',
    href: 'https://discord.gg/thorchaincommunity',
    icon: `<svg width="20" height="15" viewBox="0 0 20 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.8155 0C12.62 0.343329 12.4445 0.698502 12.285 1.06156C10.7693 0.836619 9.22574 0.836619 7.70605 1.06156C7.55055 0.698502 7.37106 0.343329 7.17559 0C5.75169 0.240729 4.36362 0.662984 3.04741 1.25888C0.438864 5.08286 -0.267107 8.80821 0.0838889 12.4822C1.61154 13.5991 3.32263 14.4515 5.14542 14.996C5.55622 14.4515 5.91921 13.8714 6.23033 13.2676C5.63999 13.0505 5.06962 12.7782 4.52319 12.4625C4.66678 12.3599 4.80637 12.2533 4.942 12.1508C8.14484 13.6424 11.8542 13.6424 15.061 12.1508C15.1966 12.2613 15.3362 12.3678 15.4798 12.4625C14.9334 12.7821 14.363 13.0505 13.7687 13.2715C14.0798 13.8753 14.4428 14.4554 14.8536 15C16.6764 14.4554 18.3875 13.6069 19.9152 12.4901C20.33 8.22809 19.2052 4.53434 16.9436 1.26284C15.6314 0.666932 14.2434 0.244672 12.8195 0.00789131L12.8155 0ZM6.67703 10.221C5.69186 10.221 4.87416 9.33702 4.87416 8.24389C4.87416 7.15077 5.65991 6.26282 6.67302 6.26282C7.68613 6.26282 8.49181 7.15468 8.47589 8.24389C8.45992 9.33305 7.68218 10.221 6.67703 10.221ZM13.322 10.221C12.3329 10.221 11.5232 9.33702 11.5232 8.24389C11.5232 7.15077 12.3089 6.26282 13.322 6.26282C14.3351 6.26282 15.1368 7.15468 15.1208 8.24389C15.1049 9.33305 14.3271 10.221 13.322 10.221Z" fill="#FAFAFA"/></svg>`
  },
  {
    label: 'LinkedIn',
    href: 'https://linkedin.com/company/thorchain',
    icon: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18.5236 0H1.47639C1.08483 0 0.709301 0.155548 0.432425 0.432425C0.155548 0.709301 0 1.08483 0 1.47639V18.5236C0 18.9152 0.155548 19.2907 0.432425 19.5676C0.709301 19.8445 1.08483 20 1.47639 20H18.5236C18.9152 20 19.2907 19.8445 19.5676 19.5676C19.8445 19.2907 20 18.9152 20 18.5236V1.47639C20 1.08483 19.8445 0.709301 19.5676 0.432425C19.2907 0.155548 18.9152 0 18.5236 0ZM5.96111 17.0375H2.95417V7.48611H5.96111V17.0375ZM4.45556 6.1625C4.11447 6.16058 3.7816 6.05766 3.49895 5.86674C3.21629 5.67582 2.99653 5.40544 2.8674 5.08974C2.73826 4.77404 2.70554 4.42716 2.77336 4.09288C2.84118 3.7586 3.0065 3.4519 3.24846 3.21148C3.49042 2.97107 3.79818 2.80772 4.13289 2.74205C4.4676 2.67638 4.81426 2.71133 5.12913 2.84249C5.44399 2.97365 5.71295 3.19514 5.90205 3.47901C6.09116 3.76288 6.19194 4.09641 6.19167 4.4375C6.19488 4.66586 6.15209 4.89253 6.06584 5.104C5.97959 5.31547 5.85165 5.50742 5.68964 5.66839C5.52763 5.82936 5.33487 5.95607 5.12285 6.04096C4.91083 6.12585 4.68389 6.16718 4.45556 6.1625ZM17.0444 17.0458H14.0389V11.8278C14.0389 10.2889 13.3847 9.81389 12.5403 9.81389C11.6486 9.81389 10.7736 10.4861 10.7736 11.8667V17.0458H7.76667V7.49306H10.6583V8.81667H10.6972C10.9875 8.22917 12.0042 7.225 13.5556 7.225C15.2333 7.225 17.0458 8.22083 17.0458 11.1375L17.0444 17.0458Z" fill="#FAFAFA"/></svg>`
  },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/@THORChainCommunity',
    icon: `<svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19.8008 3.02083C19.8008 3.02083 19.6055 1.64843 19.0039 1.04582C18.2422 0.252708 17.3906 0.24882 17 0.202166C14.2031 -1.12332e-07 10.0039 0 10.0039 0H9.99609C9.99609 0 5.79687 -1.12332e-07 3 0.202166C2.60938 0.24882 1.75781 0.252708 0.996094 1.04582C0.394531 1.64843 0.203125 3.02083 0.203125 3.02083C0.203125 3.02083 0 4.63427 0 6.24382V7.75229C0 9.36184 0.199219 10.9753 0.199219 10.9753C0.199219 10.9753 0.394531 12.3477 0.992187 12.9503C1.75391 13.7434 2.75391 13.7162 3.19922 13.8017C4.80078 13.9533 10 14 10 14C10 14 14.2031 13.9922 17 13.7939C17.3906 13.7473 18.2422 13.7434 19.0039 12.9503C19.6055 12.3477 19.8008 10.9753 19.8008 10.9753C19.8008 10.9753 20 9.36573 20 7.75229V6.24382C20 4.63427 19.8008 3.02083 19.8008 3.02083ZM7.93359 9.58345V3.98889L13.3359 6.79589L7.93359 9.58345Z" fill="#FAFAFA"/></svg>`
  },
  {
    label: 'Reddit',
    href: 'https://www.reddit.com/r/thorchainofficial/',
    icon: `<svg width="20" height="17" viewBox="0 0 20 17" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5427 2.48901C12.7594 3.3816 13.5842 4.04654 14.5691 4.04654C15.7189 4.04654 16.6511 3.14067 16.6511 2.02327C16.6511 0.90587 15.7189 0 14.5691 0C13.5637 0 12.7252 0.692445 12.53 1.61349C10.8463 1.78897 9.53148 3.17671 9.53148 4.8585C9.53148 4.86229 9.53148 4.86514 9.53148 4.86893C7.70034 4.94387 6.02831 5.4504 4.70083 6.25003C4.20791 5.87914 3.58907 5.65813 2.91752 5.65813C1.306 5.65813 0 6.9273 0 8.49336C0 9.62973 0.687164 10.6086 1.67984 11.0611C1.77648 14.3526 5.46706 17 10.0068 17C14.5466 17 18.2421 14.3497 18.3338 11.0554C19.3187 10.6001 20 9.62404 20 8.49431C20 6.92825 18.694 5.65908 17.0825 5.65908C16.4139 5.65908 15.798 5.8782 15.306 6.24623C13.9668 5.44091 12.2762 4.93438 10.4265 4.86704C10.4265 4.86419 10.4265 4.86229 10.4265 4.85945C10.4265 3.65478 11.348 2.65501 12.5427 2.49091V2.48901ZM4.5837 10.2928C4.6325 9.26454 5.33529 8.47534 6.15227 8.47534C6.96925 8.47534 7.59395 9.30912 7.54514 10.3374C7.49634 11.3656 6.88629 11.7393 6.06833 11.7393C5.25037 11.7393 4.5349 11.321 4.5837 10.2928ZM13.8624 8.47534C14.6803 8.47534 15.3831 9.26454 15.4309 10.2928C15.4797 11.321 14.7633 11.7393 13.9463 11.7393C13.1293 11.7393 12.5183 11.3665 12.4695 10.3374C12.4207 9.30912 13.0444 8.47534 13.8624 8.47534ZM12.8902 12.6717C13.0434 12.6869 13.141 12.8415 13.0815 12.98C12.5788 14.1477 11.3919 14.9682 10.0068 14.9682C8.62177 14.9682 7.43582 14.1477 6.93216 12.98C6.87262 12.8415 6.97023 12.6869 7.12348 12.6717C8.02147 12.5835 8.99268 12.5352 10.0068 12.5352C11.021 12.5352 11.9912 12.5835 12.8902 12.6717Z" fill="#FAFAFA"/></svg>`
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/thorchain',
    icon: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.0059 1.80113C12.6793 1.80113 12.9959 1.81285 14.0473 1.85974C15.0244 1.90272 15.5521 2.06681 15.9038 2.20356C16.369 2.38328 16.7051 2.60207 17.053 2.9498C17.4047 3.30143 17.6197 3.63352 17.7995 4.09846C17.9363 4.45009 18.1004 4.98144 18.1434 5.95429C18.1903 7.00918 18.2021 7.32565 18.2021 9.99414C18.2021 12.6665 18.1903 12.983 18.1434 14.034C18.1004 15.0107 17.9363 15.5382 17.7995 15.8898C17.6197 16.3548 17.4008 16.6908 17.053 17.0385C16.7012 17.3901 16.369 17.605 15.9038 17.7847C15.5521 17.9215 15.0205 18.0856 14.0473 18.1285C12.992 18.1754 12.6754 18.1871 10.0059 18.1871C7.33242 18.1871 7.01583 18.1754 5.96443 18.1285C4.9873 18.0856 4.45964 17.9215 4.10788 17.7847C3.64276 17.605 3.30662 17.3862 2.95876 17.0385C2.607 16.6869 2.39203 16.3548 2.21223 15.8898C2.07543 15.5382 1.91128 15.0068 1.86828 14.034C1.82138 12.9791 1.80965 12.6626 1.80965 9.99414C1.80965 7.32174 1.82138 7.00527 1.86828 5.95429C1.91128 4.97753 2.07543 4.45009 2.21223 4.09846C2.39203 3.63352 2.6109 3.29752 2.95876 2.9498C3.31053 2.59816 3.64276 2.38328 4.10788 2.20356C4.45964 2.06681 4.99121 1.90272 5.96443 1.85974C7.01583 1.81285 7.33242 1.80113 10.0059 1.80113ZM10.0059 0C7.28943 0 6.94938 0.011721 5.88235 0.0586052C4.81923 0.105489 4.08833 0.277398 3.45515 0.52354C2.79461 0.781403 2.23569 1.12131 1.68067 1.68002C1.12175 2.23481 0.781708 2.79351 0.523744 3.44989C0.277506 4.08674 0.105531 4.81344 0.0586281 5.87615C0.0117256 6.94667 0 7.28658 0 10.002C0 12.7173 0.0117256 13.0572 0.0586281 14.1239C0.105531 15.1866 0.277506 15.9172 0.523744 16.5501C0.781708 17.2104 1.12175 17.7691 1.68067 18.3239C2.23569 18.8787 2.79461 19.2225 3.45124 19.4765C4.08833 19.7226 4.81532 19.8945 5.87844 19.9414C6.94548 19.9883 7.28552 20 10.002 20C12.7184 20 13.0584 19.9883 14.1255 19.9414C15.1886 19.8945 15.9195 19.7226 16.5527 19.4765C17.2093 19.2225 17.7682 18.8787 18.3232 18.3239C18.8782 17.7691 19.2222 17.2104 19.4763 16.554C19.7225 15.9172 19.8945 15.1905 19.9414 14.1278C19.9883 13.0611 20 12.7212 20 10.0059C20 7.29049 19.9883 6.95058 19.9414 5.88396C19.8945 4.82125 19.7225 4.09064 19.4763 3.45771C19.23 2.79351 18.89 2.23481 18.3311 1.68002C17.776 1.12522 17.2171 0.781403 16.5605 0.527447C15.9234 0.281305 15.1964 0.109396 14.1333 0.0625122C13.0623 0.011721 12.7223 0 10.0059 0Z" fill="#FAFAFA"/><path d="M10.0035 4.864C7.16593 4.864 4.8638 7.16523 4.8638 10.0017C4.8638 12.8382 7.16593 15.1394 10.0035 15.1394C12.8411 15.1394 15.1433 12.8382 15.1433 10.0017C15.1433 7.16523 12.8411 4.864 10.0035 4.864ZM10.0035 13.3344C8.16261 13.3344 6.66955 11.8419 6.66955 10.0017C6.66955 8.16152 8.16261 6.66904 10.0035 6.66904C11.8445 6.66904 13.3375 8.16152 13.3375 10.0017C13.3375 11.8419 11.8445 13.3344 10.0035 13.3344Z" fill="#FAFAFA"/><path d="M16.5407 4.66338C16.5407 5.32757 16.0013 5.86283 15.3407 5.86283C14.6763 5.86283 14.1408 5.32367 14.1408 4.66338C14.1408 3.99919 14.6802 3.46392 15.3407 3.46392C16.0013 3.46392 16.5407 4.00309 16.5407 4.66338Z" fill="#FAFAFA"/></svg>`
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/THORChain/',
    icon: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19.9996 10.0367C19.9996 4.49365 15.5225 0 9.9998 0C4.47711 0 0 4.49365 0 10.0367C0 14.7436 3.22874 18.6932 7.58425 19.778V13.104H5.52229V10.0367H7.58425V8.7151C7.58425 5.29899 9.12462 3.7156 12.4662 3.7156C13.0997 3.7156 14.1929 3.84046 14.6401 3.96491V6.74509C14.4041 6.7202 13.9941 6.70775 13.4849 6.70775C11.8454 6.70775 11.2118 7.33123 11.2118 8.95196V10.0367H14.4781L13.9169 13.104H11.2118V20C16.1633 19.3998 20 15.1683 20 10.0367H19.9996Z" fill="#FAFAFA"/></svg>`
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@thorchaincontact',
    icon: `<svg width="15" height="17" viewBox="0 0 20 23" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.8236 8.25794C16.2825 9.31189 18.0697 9.93201 20 9.93201V6.17812C19.6347 6.1782 19.2703 6.1397 18.9129 6.06318V9.01802C16.9828 9.01802 15.1958 8.3979 13.7366 7.34403V15.0046C13.7366 18.8368 10.6626 21.9432 6.87093 21.9432C5.45616 21.9432 4.14119 21.511 3.04884 20.7696C4.29558 22.0579 6.03424 22.8571 7.95777 22.8571C11.7497 22.8571 14.8238 19.7507 14.8238 15.9184L14.8236 8.25794ZM16.1647 4.47073C15.4191 3.64754 14.9296 2.58372 14.8236 1.40761V0.924784H13.7935C14.0528 2.41961 14.9372 3.6967 16.1647 4.47073ZM5.44709 17.8289C5.03053 17.2769 4.80542 16.6017 4.80643 15.9074C4.80643 14.1547 6.21243 12.7336 7.94706 12.7336C8.27034 12.7335 8.59168 12.7835 8.89975 12.8823V9.04452C8.53972 8.99465 8.17636 8.97348 7.81315 8.98125V11.9684C7.50484 11.8696 7.18335 11.8194 6.85999 11.8197C5.12536 11.8197 3.71943 13.2407 3.71943 14.9936C3.71943 16.2331 4.4222 17.3062 5.44709 17.8289Z" fill="#FAFAFA"/><path d="M13.728 7.34395C15.1873 8.39782 16.9742 9.01794 18.9043 9.01794V6.0631C17.827 5.83117 16.8732 5.26217 16.1561 4.47073C14.9286 3.69662 14.0442 2.41953 13.7849 0.924784H11.079V15.9182C11.0728 17.6661 9.66924 19.0815 7.93833 19.0815C6.91834 19.0815 6.01217 18.5901 5.43828 17.8289C4.41347 17.3062 3.7107 16.233 3.7107 14.9937C3.7107 13.2409 5.11663 11.8198 6.85126 11.8198C7.18361 11.8198 7.50394 11.8721 7.80442 11.9685V8.98132C4.07934 9.0591 1.08348 12.1352 1.08348 15.9183C1.08348 17.8068 1.82952 19.5188 3.04035 20.7697C4.13269 21.511 5.44766 21.9433 6.86243 21.9433C10.6542 21.9433 13.7281 18.8368 13.7281 15.0046L13.728 7.34395Z" fill="#FAFAFA"/><path d="M18.9079 6.05215V5.25318C17.9363 5.25467 16.9839 4.9797 16.1596 4.4597C16.8893 5.26706 17.8501 5.82375 18.9079 6.05215ZM13.7884 0.913832C13.7637 0.770975 13.7447 0.627176 13.7315 0.482829V0H9.99534V14.9936C9.98937 16.7413 8.58584 18.1566 6.85478 18.1566C6.34656 18.1566 5.86673 18.0347 5.4418 17.818C6.01569 18.5791 6.92185 19.0704 7.94185 19.0704C9.6726 19.0704 11.0764 17.6553 11.0825 15.9073V0.913832H13.7884ZM7.80809 8.97037V8.11981C7.4959 8.07669 7.18116 8.05505 6.86602 8.05521C3.07395 8.05513 0 11.1617 0 14.9936C0 17.396 1.20812 19.5132 3.04394 20.7586C1.83311 19.5078 1.08707 17.7957 1.08707 15.9073C1.08707 12.1242 4.08286 9.04815 7.80809 8.97037Z" fill="#FAFAFA"/></svg>`
  },
  {
    label: 'Apple',
    href: 'https://podcasts.apple.com/us/podcast/thorchain-weekly-live/id1719319894',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="3.84 32.0 376.768 448.0" width="17" height="20"><path fill="#ffffff" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>`
  },
  {
    label: 'Spotify',
    href: 'https://open.spotify.com/show/1uMxtHcV3PCvB9gf3aanjl',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 167.5 167.5" width="20" height="20"><path fill="#ffffff" d="M83.7 0C37.5 0 0 37.5 0 83.7c0 46.3 37.5 83.7 83.7 83.7 46.3 0 83.7-37.5 83.7-83.7S130 0 83.7 0zM122 120.8c-1.4 2.5-4.6 3.2-7 1.7-19.8-12-44.5-14.7-73.7-8-2.8.5-5.6-1.2-6.2-4-.2-2.8 1.5-5.6 4-6.2 32-7.3 59.6-4.2 81.6 9.3 2.6 1.5 3.4 4.7 1.8 7.2zM132.5 98c-2 3-6 4-9 2.2-22.5-14-56.8-18-83.4-9.8-3.2 1-7-1-8-4.3s1-7 4.6-8c30.4-9 68.2-4.5 94 11 3 2 4 6 2 9zm1-23.8c-27-16-71.6-17.5-97.4-9.7-4 1.3-8.2-1-9.5-5.2-1.3-4 1-8.5 5.2-9.8 29.6-9 78.8-7.2 109.8 11.2 3.7 2.2 5 7 2.7 10.7-2 3.8-7 5-10.6 2.8z"/></svg>`
  },
  {
    label: 'RSS.com',
    href: 'https://rss.com/podcasts/thorchain/',
    icon: `<svg width="20" height="20" viewBox="27.648 27.648 456.704 456.704" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M332 484H237C237.091 428.549 215.073 375.348 175.82 336.181C136.61 296.99 83.4372 274.982 28 275.001V180.001C108.645 179.915 186.005 211.946 242.985 269.016C300.081 325.977 332.117 403.349 332 484Z" fill="#ffffff"/><path d="M160.998 417.976C160.77 449.654 138.227 476.773 107.124 482.785C76.021 488.798 44.9948 472.034 32.9773 442.723C20.9598 413.412 31.2881 379.693 57.6599 362.141C84.0317 344.589 119.124 348.078 141.524 370.478C154.111 383.066 161.126 400.175 160.998 417.976Z" fill="#ffffff"/><path d="M483.999 484H389.298C389.423 388.232 351.491 296.365 283.9 228.736C216.462 160.965 124.902 122.918 29.4476 123.001H28V28.0004H29.4476C150.03 27.8503 265.7 75.9205 350.851 161.571C436.265 246.97 484.188 363.024 483.999 484Z" fill="#ffffff"/></svg>`
  }
]

function RollingText({ text }: { text: string }) {
  return (
    <span className="overflow-hidden" aria-label={text}>
      {text.split('').map((char, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="inline-block whitespace-pre-wrap transition-transform duration-300 text-shadow-[0_1.5em_0_currentColor] group-hover:-translate-y-full"
          style={{ transitionDelay: `${i * 0.008}s` }}
        >
          {char}
        </span>
      ))}
    </span>
  )
}

interface TileProps {
  label: string
  animationData: object
  href: string
  onClick?: () => void
}

function MenuTile({ label, animationData, href, onClick }: TileProps) {
  const lottieRef = useRef<LottieRefCurrentProps>(null)

  const handleMouseEnter = () => {
    lottieRef.current?.animationItem?.setLoop(true)
    lottieRef.current?.goToAndPlay(0, true)
  }

  const handleMouseLeave = () => {
    lottieRef.current?.animationItem?.setLoop(false)
  }

  return (
    <a
      href={href}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'flex size-full items-center border-b border-neutral-800 py-5 text-left transition-colors duration-150',
        'md:rounded-15 md:flex-col md:items-start md:border-none md:bg-neutral-900 md:px-5 md:py-6.25',
        'cursor-pointer md:hover:bg-neutral-700'
      )}
    >
      <span className="text-[30px] leading-tight font-medium text-white">{label}</span>
      {/* Desktop: Lottie fills the bottom */}
      <div className="hidden grow md:block">
        <Lottie
          lottieRef={lottieRef}
          animationData={animationData}
          autoplay={false}
          loop={false}
          className="inline-flex size-full items-center justify-center overflow-visible [&>svg]:size-full"
        />
      </div>
      {/* Mobile: icon before label */}
      <div className="-order-1 size-12.5 shrink-0 md:hidden">
        <Lottie
          animationData={animationData}
          autoplay={false}
          loop={false}
          className="inline-flex size-full items-center justify-center overflow-visible [&>svg]:size-full"
        />
      </div>
    </a>
  )
}

interface SendMemoMenuProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

const SUBDOMAIN_HOSTS: Record<string, string> = {
  '/': PRIMARY_HOST,
  ...Object.fromEntries(SUBDOMAIN_ROUTES.map(({ path, host }) => [path, host]))
}

function resolveHref(path: string): string {
  if (typeof window === 'undefined') return path
  const [pathname, search = ''] = path.split('?')
  const host = SUBDOMAIN_HOSTS[pathname]
  if (host && window.location.hostname.endsWith('.thorchain.org')) {
    const suffix = search ? `?${search}` : ''
    return `https://${host}/${suffix}`
  }
  return path
}

export function GlobalMenu({ isOpen, onOpenChange }: SendMemoMenuProps) {
  const t = useTranslations('menu')
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [newsletterError, setNewsletterError] = useState('')

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setNewsletterStatus('loading')
    setNewsletterError('')
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail })
      })
      if (res.ok) {
        setNewsletterStatus('success')
        setNewsletterEmail('')
      } else {
        const data = await res.json().catch(() => ({}))
        setNewsletterError((data as { error?: string }).error ?? t('genericError'))
        setNewsletterStatus('error')
      }
    } catch {
      setNewsletterError(t('genericError'))
      setNewsletterStatus('error')
    }
  }

  const closeMenu = () => onOpenChange(false)

  const tiles: TileProps[] = [
    { label: t('swap'), animationData: swapAnim, href: resolveHref('/'), onClick: closeMenu },
    { label: '$TCY', animationData: tcyAnim, href: resolveHref('/tcy'), onClick: closeMenu },
    { label: t('bond'), animationData: bondAnim, href: resolveHref('/bond'), onClick: closeMenu },
    { label: t('memo'), animationData: memoAnim, href: resolveHref('/memo'), onClick: closeMenu },
    { label: t('pool'), animationData: poolsAnim, href: resolveHref('/pool'), onClick: closeMenu },
    { label: t('thorname'), animationData: thornameAnim, href: resolveHref('/thorname'), onClick: closeMenu },
    { label: t('affiliate'), animationData: nodeAnim, href: resolveHref('/affiliate'), onClick: closeMenu }
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-0 z-50 overflow-y-auto bg-black text-white',
            'scrollbar-none [&::-webkit-scrollbar]:hidden',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'duration-200'
          )}
        >
          <VisuallyHidden>
            <DialogPrimitive.Title>Navigation Menu</DialogPrimitive.Title>
          </VisuallyHidden>

          <div className="flex min-h-full flex-col">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between px-7.5 py-4.5 md:px-15 xl:px-22.5">
              <a
                href={AppConfig.logoLink || '/'}
                className="flex items-center gap-3"
                rel="noopener noreferrer"
                target={AppConfig.logoLink ? '_blank' : '_self'}
              >
                <Image src={AppConfig.logo} alt={AppConfig.title} width={32} height={32} priority />
                <span className="hidden md:inline-flex [&_path]:fill-white">
                  <HeaderLogoText />
                </span>
              </a>

              <div className="flex items-center gap-2.5">
                <a
                  href={resolveHref('/')}
                  onClick={closeMenu}
                  className="group bg-green-default hidden items-center gap-2.5 rounded-full border border-transparent px-4.5 py-2.5 text-[15px] font-medium text-black transition-colors hover:bg-white md:flex"
                >
                  <RollingText text={t('launchApp')} />
                  <span className="relative flex size-4.25 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black transition-all duration-300 group-hover:scale-150 group-hover:bg-black">
                    <span
                      aria-hidden="true"
                      className="inline-flex size-full items-center justify-center fill-current transition-transform duration-300 group-hover:translate-x-full group-hover:-translate-y-full [&>svg]:size-full"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18">
                        <path d="M11.945 11.055c0 .26-.14.4-.395.405l-.32.01c-.27.01-.41-.13-.405-.396L10.85 7.7l-.04-.02-4.505 4.506c-.185.185-.385.185-.57 0l-.29-.29c-.185-.185-.18-.38.005-.566l4.505-4.505-.02-.04-3.37.03C6.3 6.82 6.16 6.68 6.17 6.41l.005-.325c.01-.26.15-.39.405-.395l5.365.005z" />
                      </svg>
                    </span>
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 inline-flex size-full -translate-x-full translate-y-full items-center justify-center fill-white transition-transform duration-300 group-hover:translate-x-0 group-hover:translate-y-0 [&>svg]:size-full"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18">
                        <path d="M11.945 11.055c0 .26-.14.4-.395.405l-.32.01c-.27.01-.41-.13-.405-.396L10.85 7.7l-.04-.02-4.505 4.506c-.185.185-.385.185-.57 0l-.29-.29c-.185-.185-.18-.38.005-.566l4.505-4.505-.02-.04-3.37.03C6.3 6.82 6.16 6.68 6.17 6.41l.005-.325c.01-.26.15-.39.405-.395l5.365.005z" />
                      </svg>
                    </span>
                  </span>
                </a>
                <DialogPrimitive.Close
                  className="flex size-10.5 cursor-pointer items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-neutral-200 focus:outline-none"
                  aria-label="Close"
                >
                  <X className="size-4.5" strokeWidth={2.5} />
                </DialogPrimitive.Close>
              </div>
            </div>

            {/* Main content */}
            <div className="flex flex-1 flex-wrap gap-12.5 px-7.5 pt-12.5 pb-7.5 md:px-15 md:pb-7.5 xl:flex-nowrap xl:px-22.5 xl:pb-15">
              {/* Tiles nav */}
              <nav className="w-full shrink-0 xl:w-2/3">
                <ul className="w-full md:grid md:w-fit md:grid-cols-4 md:gap-5">
                  {tiles.map(tile => (
                    <li key={tile.label} className="md:aspect-square md:max-w-55">
                      <MenuTile label={tile.label} animationData={tile.animationData} href={tile.href} onClick={tile.onClick} />
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Right column */}
              <div className="flex flex-col gap-20">
                {/* Socials */}
                <div className="flex flex-col gap-10">
                  <span className="text-xl font-medium text-white">{t('socials')}</span>
                  <ul className="flex flex-wrap gap-1.75 md:grid md:grid-cols-2 md:gap-x-20 md:gap-y-5">
                    {SOCIAL_LINKS.map(link => (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-3 transition-all duration-150 md:hover:translate-x-2.5"
                        >
                          {/* Mobile: dark square tile with icon */}
                          <span
                            className="inline-flex size-12.5 shrink-0 items-center justify-center rounded-[5px] border border-neutral-800 bg-neutral-900 md:hidden [&_svg]:size-5"
                            dangerouslySetInnerHTML={{ __html: link.icon }}
                          />
                          {/* Desktop: plain icon */}
                          <span
                            className="hidden size-5 shrink-0 items-center justify-center md:inline-flex [&_svg]:size-full"
                            dangerouslySetInnerHTML={{ __html: link.icon }}
                          />
                          <span className="hidden text-base font-medium text-[#808080] transition-colors group-hover:text-white md:inline">
                            {link.label}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Newsletter */}
                <div className="hidden flex-col gap-5 md:flex">
                  <p className="text-lg leading-snug font-medium text-white">{t('newsletterPitch')}</p>
                  {newsletterStatus === 'success' ? (
                    <p className="text-green-default text-base">{t('subscribed')}</p>
                  ) : (
                    <form className="flex max-w-175 flex-col gap-2" onSubmit={handleNewsletterSubmit}>
                      <div className="flex rounded-[10px] bg-white px-3.75 py-3">
                        <label className="grow">
                          <input
                            type="email"
                            placeholder={t('emailPlaceholder')}
                            className="size-full bg-transparent text-lg text-neutral-950 placeholder:text-neutral-400 focus:outline-none"
                            value={newsletterEmail}
                            onChange={e => setNewsletterEmail(e.target.value)}
                            disabled={newsletterStatus === 'loading'}
                            required
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={newsletterStatus === 'loading'}
                          className="hover:border-neutral-650 hover:bg-neutral-650 cursor-pointer rounded-[5px] border border-black bg-neutral-950 px-3.75 py-2.5 text-[15px] text-white transition-colors disabled:opacity-60"
                        >
                          {newsletterStatus === 'loading' ? t('signingUp') : t('signUp')}
                        </button>
                      </div>
                      {newsletterStatus === 'error' && <p className="text-sm text-red-400">{newsletterError}</p>}
                    </form>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile: Launch App full-width button at bottom */}
            <div className="px-7.5 pb-7.5 md:hidden">
              <a
                href={resolveHref('/')}
                onClick={closeMenu}
                className="group bg-green-default flex h-23.25 w-full items-center justify-center rounded-[5px] text-[18px] font-medium text-black transition-colors hover:bg-white"
              >
                <RollingText text={t('launchApp')} />
              </a>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
