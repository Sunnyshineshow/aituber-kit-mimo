import settingsStore from '@/features/stores/settings'
import { EMOTIONS } from '@/features/messages/messages'

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const emotionPattern = new RegExp(
  `\\[(${EMOTIONS.map(escapeRegExp).join('|')})\\]`,
  'gi'
)

export const AssistantText = ({ message }: { message: string }) => {
  const characterName = settingsStore((s) => s.characterName)
  const showCharacterName = settingsStore((s) => s.showCharacterName)
  const showPresetQuestions = settingsStore((s) => s.showPresetQuestions)
  const presetQuestions = settingsStore((s) => s.presetQuestions)

  // Check if preset questions should be shown AND there are actual questions
  const shouldShowPresetQuestions =
    showPresetQuestions && presetQuestions.length > 0
  const sanitizedMessage = message
    .replace(emotionPattern, '')
    .replace(/\[motion:[^\]]*\]/gi, '')

  return (
    <div
      className={`absolute bottom-0 left-0 ${shouldShowPresetQuestions ? 'mb-[150px] sm:mb-[182px]' : 'mb-[86px] sm:mb-[104px]'} w-full z-10`}
    >
      <div className="mx-auto w-full max-w-4xl px-3 py-2 sm:px-4">
        <div className="theme-surface-elevated overflow-hidden rounded-xl border backdrop-blur-md">
          {showCharacterName && (
            <div className="flex items-center gap-2 border-b border-primary/20 px-3 py-2 sm:px-5">
              <span className="text-xs font-bold tracking-wide text-theme-default sm:text-sm">
                {characterName}
              </span>
            </div>
          )}
          <div className="px-3 py-3 sm:px-5 sm:py-4">
            <div className="line-clamp-4 text-sm font-bold leading-relaxed text-secondary sm:text-base">
              {sanitizedMessage}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
