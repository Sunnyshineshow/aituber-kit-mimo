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
import { languageOptions } from '@/components/settings/languageOptions'

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

const QuickStart = () => {
  const { t } = useTranslation()
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
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-theme">
            1
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold">{t('QuickStartTitle')}</div>
            <p className="mt-1 text-sm leading-6 text-text-primary">
              {t('QuickStartDescription')}
            </p>
          </div>
        </div>
      </div>

      <QuickSection
        title={t('QuickStartBasicsTitle')}
        description={t('QuickStartBasicsDescription')}
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
            label={t('QuickStartDetailedDisplaySettings')}
            onClick={() => goTo('based')}
          />
        </div>
      </QuickSection>

      <QuickSection
        title={t('QuickStartAIConversationTitle')}
        description={t('QuickStartAIConversationDescription')}
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
            label={t('QuickStartDetailedAISettings')}
            onClick={() => goTo('ai')}
          />
          <DetailLink
            label={t('QuickStartDetailedMemorySettings')}
            onClick={() => goTo('memory')}
          />
        </div>
      </QuickSection>

      <QuickSection
        title={t('QuickStartVoiceTitle')}
        description={t('QuickStartVoiceDescription')}
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
            label={t('QuickStartDetailedVoiceSettings')}
            onClick={() => goTo('voice')}
          />
          <DetailLink
            label={t('QuickStartSpeechInputSettings')}
            onClick={() => goTo('speechInput')}
          />
        </div>
      </QuickSection>

      <QuickSection
        title={t('QuickStartOptionalFeaturesTitle')}
        description={t('QuickStartOptionalFeaturesDescription')}
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
  <section className="pt-0">
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
    <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-primary">
      {label}
    </span>
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
    className="inline-flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-white/70 px-3 py-2 text-left text-sm font-bold text-text1 shadow-sm transition hover:border-primary hover:bg-primary/10 hover:text-primary"
    onClick={onClick}
  >
    <span>{label}</span>
    <span className="text-secondary">→</span>
  </button>
)

export default QuickStart
