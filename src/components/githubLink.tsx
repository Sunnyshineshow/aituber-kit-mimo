import Image from 'next/image'
import { buildUrl } from '@/utils/buildUrl'

export const GitHubLink = () => {
  return (
    <div className="absolute right-0 z-15 m-3 sm:m-6">
      <a
        draggable={false}
        href="https://github.com/tegnike/aituber-kit"
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="theme-surface-contrast flex rounded-xl p-2 shadow-md shadow-primary/15 ring-1 ring-primary/15 transition-colors">
          <Image
            alt="GitHub Repository Link"
            height={24}
            width={24}
            src={buildUrl('/github-mark-white.svg')}
          />
          <div className="mx-2 font-bold">Fork me</div>
        </div>
      </a>
    </div>
  )
}
