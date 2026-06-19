import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { ReactNode } from 'react'
import settingsStore from '@/features/stores/settings'
import menuStore from '@/features/stores/menu'
import { AIService, AIVoice, Language } from '@/features/constants/settings'
import { ModelSelector } from './modelProvider/ModelSelector'
import { aiServiceOptions } from './modelProvider/utils/aiServiceConfigs'
import { useAIServiceHandlers } from './modelProvider/hooks/useAIServiceHandlers'
import { useModelProviderState } from './modelProvider/hooks/useModelProviderState'
import { ToggleSwitch } from '../toggleSwitch'

type QuickStartDestination =
  | 'based'
  | 'character'
  | 'ai'
  | 'memory'
  | 'voice'
  | 'speechInput'
  | 'youtube'
  | 'idle'
  | 'other'

const languageOptions: { value: Language; label: string }[] = [
  { value: 'ja', label: 'Japanese - 日本語' },
  { value: 'en', label: 'English - 英語' },
  { value: 'ko', label: 'Korean - 韓国語' },
  { value: 'zh-CN', label: 'Simplified Chinese - 簡体字中国語' },
  { value: 'zh-TW', label: 'Traditional Chinese - 繁体字中国語' },
  { value: 'fr', label: 'French - フランス語' },
  { value: 'es', label: 'Spanish - スペイン語' },
  { value: 'pt', label: 'Portuguese - ポルトガル語' },
  { value: 'de', label: 'German - ドイツ語' },
  { value: 'it', label: 'Italian - イタリア語' },
  { value: 'vi', label: 'Vietnamese - ベトナム語' },
  { value: 'th', label: 'Thai - タイ語' },
  { value: 'pl', label: 'Polish - ポーランド語' },
  { value: 'ru', label: 'Russian - ロシア語' },
  { value: 'hi', label: 'Hindi - ヒンディー語' },
  { value: 'ar', label: 'Arabic - アラビア語' },
]

const QuickStart = () => {
  const { t } = useTranslation()
  const isJa = i18n.language === 'ja'
  const modelState = useModelProviderState()
  const { handleAIServiceChange, updateMultiModalModeForModel } =
    useAIServiceHandlers()

  const characterName = settingsStore((s) => s.characterName)
  const userDisplayName = settingsStore((s) => s.userDisplayName)
  const selectLanguage = settingsStore((s) => s.selectLanguage)
  const selectVoice = settingsStore((s) => s.selectVoice)
  const maxTokens = settingsStore((s) => s.maxTokens)
  const maxPastMessages = settingsStore((s) => s.maxPastMessages)
  const showAssistantText = settingsStore((s) => s.showAssistantText)
  const showCharacterName = settingsStore((s) => s.showCharacterName)

  const goTo = (tab: QuickStartDestination) => {
    menuStore.setState({
      activeSettingsTab: tab,
      settingsSearchQuery: '',
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="text-lg font-bold">
          {isJa ? 'まずはここだけで始められます' : 'Start here'}
        </div>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          {isJa
            ? 'キャラクター名、使うAI、声、会話の長さだけをまとめています。細かい調整は下の各詳細設定から変更できます。'
            : 'Set the character name, AI, voice, and conversation length here. Use the detailed settings for advanced control.'}
        </p>
      </div>

      <QuickSection
        title={isJa ? '1. 基本情報' : '1. Basics'}
        description={
          isJa
            ? '表示名と言語など、最初に決める項目です。'
            : 'Set names and language first.'
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledField label={t('CharacterName')}>
            <input
              className="w-full rounded-lg bg-white px-4 py-2 hover:bg-white-hover"
              value={characterName}
              onChange={(e) =>
                settingsStore.setState({ characterName: e.target.value })
              }
            />
          </LabeledField>
          <LabeledField label={t('UserDisplayName')}>
            <input
              className="w-full rounded-lg bg-white px-4 py-2 hover:bg-white-hover"
              value={userDisplayName}
              onChange={(e) =>
                settingsStore.setState({ userDisplayName: e.target.value })
              }
            />
          </LabeledField>
          <LabeledField label={t('Language')}>
            <select
              className="w-full rounded-lg bg-white px-4 py-2 hover:bg-white-hover"
              value={selectLanguage}
              onChange={(e) => {
                const language = e.target.value as Language
                settingsStore.setState({ selectLanguage: language })
                i18n.changeLanguage(language)
              }}
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </LabeledField>
        </div>
        <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap sm:gap-x-4 sm:gap-y-3">
          <InlineToggle
            label={t('ShowAssistantText')}
            enabled={showAssistantText}
            onChange={(value) =>
              settingsStore.setState({ showAssistantText: value })
            }
          />
          <InlineToggle
            label={t('ShowCharacterName')}
            enabled={showCharacterName}
            onChange={(value) =>
              settingsStore.setState({ showCharacterName: value })
            }
          />
        </div>
        <div className="mt-4">
          <DetailLink
            label={
              isJa ? '見た目や背景を詳しく設定' : 'Detailed display settings'
            }
            onClick={() => goTo('based')}
          />
        </div>
      </QuickSection>

      <QuickSection
        title={isJa ? '2. AIと会話' : '2. AI and conversation'}
        description={
          isJa
            ? '迷ったらAIサービスとモデルだけ設定すれば大丈夫です。'
            : 'Choose the AI service and model. Advanced behavior can be tuned later.'
        }
      >
        <LabeledField label={t('SelectAIService')}>
          <select
            className="w-full rounded-lg bg-white px-4 py-2 hover:bg-white-hover sm:w-col-span-2"
            value={modelState.selectAIService}
            onChange={(e) => handleAIServiceChange(e.target.value as AIService)}
          >
            {aiServiceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </LabeledField>
        <div className="-my-2">
          <ModelSelector
            aiService={modelState.selectAIService as AIService}
            selectedModel={modelState.selectAIModel}
            customModel={modelState.customModel}
            onModelChange={(model) => {
              settingsStore.setState({ selectAIModel: model })
              updateMultiModalModeForModel(
                modelState.selectAIService as AIService,
                model
              )
            }}
            onCustomModelToggle={() =>
              settingsStore.setState({ customModel: !modelState.customModel })
            }
          />
        </div>
        {modelState.selectAIService !== 'dify' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledField label={t('MaxTokens')}>
              <input
                type="number"
                min="1"
                className="w-32 rounded-lg bg-white px-4 py-2 hover:bg-white-hover"
                value={maxTokens}
                onChange={(e) => {
                  const value = parseInt(e.target.value)
                  if (!Number.isNaN(value) && value >= 1) {
                    settingsStore.setState({ maxTokens: value })
                  }
                }}
              />
            </LabeledField>
            <LabeledField label={t('MaxPastMessages')}>
              <input
                type="number"
                min="1"
                max="9999"
                className="w-32 rounded-lg bg-white px-4 py-2 hover:bg-white-hover"
                value={maxPastMessages}
                onChange={(e) => {
                  const value = parseInt(e.target.value)
                  if (!Number.isNaN(value) && value >= 1 && value <= 9999) {
                    settingsStore.setState({ maxPastMessages: value })
                  }
                }}
              />
            </LabeledField>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-3">
          <DetailLink
            label={isJa ? 'AIを詳しく設定' : 'Detailed AI settings'}
            onClick={() => goTo('ai')}
          />
          <DetailLink
            label={isJa ? '記憶を詳しく設定' : 'Detailed memory settings'}
            onClick={() => goTo('memory')}
          />
        </div>
      </QuickSection>

      <QuickSection
        title={isJa ? '3. 声' : '3. Voice'}
        description={
          isJa
            ? 'キャラクターがどの音声エンジンで話すかを選びます。'
            : 'Choose the voice engine used by the character.'
        }
      >
        <LabeledField label={t('SyntheticVoiceEngineChoice')}>
          <select
            value={selectVoice}
            onChange={(e) =>
              settingsStore.setState({
                selectVoice: e.target.value as AIVoice,
              })
            }
            className="w-full rounded-lg bg-white px-4 py-2 hover:bg-white-hover sm:w-col-span-2"
          >
            <option value="voicevox">{t('UsingVoiceVox')}</option>
            <option value="koeiromap">{t('UsingKoeiromap')}</option>
            <option value="google">{t('UsingGoogleTTS')}</option>
            <option value="stylebertvits2">{t('UsingStyleBertVITS2')}</option>
            <option value="aivis_speech">{t('UsingAivisSpeech')}</option>
            <option value="aivis_cloud_api">{t('UsingAivisCloudAPI')}</option>
            <option value="gsvitts">{t('UsingGSVITTS')}</option>
            <option value="elevenlabs">{t('UsingElevenLabs')}</option>
            <option value="cartesia">{t('UsingCartesia')}</option>
            <option value="openai">{t('UsingOpenAITTS')}</option>
            <option value="azure">{t('UsingAzureTTS')}</option>
          </select>
        </LabeledField>
        <div className="mt-3 flex flex-wrap gap-3">
          <DetailLink
            label={isJa ? '声を詳しく設定' : 'Detailed voice settings'}
            onClick={() => goTo('voice')}
          />
          <DetailLink
            label={isJa ? 'マイク入力を設定' : 'Speech input settings'}
            onClick={() => goTo('speechInput')}
          />
        </div>
      </QuickSection>

      <QuickSection
        title={isJa ? '4. 必要になったら使う設定' : '4. Optional features'}
        description={
          isJa
            ? '配信、画像、スライド、自動発話などは、使いたくなった時に開けば大丈夫です。'
            : 'Streaming, images, slides, and automation can be configured when needed.'
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailLink
            label={t('CharacterSettings')}
            onClick={() => goTo('character')}
          />
          <DetailLink
            label={t('YoutubeSettings')}
            onClick={() => goTo('youtube')}
          />
          <DetailLink label={t('IdleSettings')} onClick={() => goTo('idle')} />
          <DetailLink
            label={t('OtherSettings')}
            onClick={() => goTo('other')}
          />
        </div>
      </QuickSection>
    </div>
  )
}

const QuickSection = ({
  children,
  description,
  title,
}: {
  children: ReactNode
  description: string
  title: string
}) => (
  <section className="border-t border-gray-200 pt-5 first:border-t-0 first:pt-0">
    <h2 className="text-xl font-bold">{title}</h2>
    <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
    <div className="mt-4">{children}</div>
  </section>
)

const LabeledField = ({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) => (
  <label className="block">
    <span className="mb-2 block text-sm font-bold text-text1">{label}</span>
    {children}
  </label>
)

const InlineToggle = ({
  enabled,
  label,
  onChange,
}: {
  enabled: boolean
  label: string
  onChange: (value: boolean) => void
}) => (
  <div className="flex min-h-[32px] items-center gap-2">
    <ToggleSwitch enabled={enabled} onChange={onChange} />
    <span className="text-sm font-bold">{label}</span>
  </div>
)

const DetailLink = ({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) => (
  <button
    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm font-bold text-text1 shadow-sm transition hover:border-primary hover:text-primary"
    onClick={onClick}
  >
    {label}
  </button>
)

export default QuickStart
