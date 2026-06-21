import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import menuStore from '@/features/stores/menu'
import settingsStore from '@/features/stores/settings'
import { Language } from '@/features/constants/settings'

import { IconButton } from '../iconButton'
import Image from 'next/image'
import Description from './description'
import Based from './based'
import Character from './character'
import AI from './ai'
import Voice from './voice'
import YouTube from './youtube'
import Slide from './slide'
import Other from './other'
import SpeechInput from './speechInput'
import Images from './images'
import MemorySettings from './memorySettings'
import PresenceSettings from './presenceSettings'
import IdleSettings from './idleSettings'
import GameCommentarySettings from './gameCommentarySettings'
import KioskSettings from './kioskSettings'
import QuickStart from './quickStart'
import { languageOptions } from '@/components/settings/languageOptions'

type Props = {
  onClickClose: () => void
}

const tabsWithRedundantPanelTitle = new Set([
  'character',
  'ai',
  'memory',
  'voice',
  'speechInput',
  'youtube',
  'gameCommentary',
  'slide',
  'images',
  'presence',
  'idle',
  'kiosk',
  'based',
  'other',
])

const Settings = (props: Props) => {
  return (
    <div className="theme-settings-backdrop absolute z-40 h-full w-full overflow-hidden">
      <div className="theme-settings-shell mx-auto flex h-full w-full max-w-[1280px] flex-col overflow-hidden border-x shadow-xl backdrop-blur-sm md:my-5 md:h-[calc(100%-2.5rem)] md:w-[calc(100%-3rem)] md:rounded-xl md:border">
        <Header {...props} />
        <Main />
        <Footer />
      </div>
    </div>
  )
}
export default Settings

const Header = ({ onClickClose }: Pick<Props, 'onClickClose'>) => {
  const { i18n } = useTranslation()
  const selectAIService = settingsStore((s) => s.selectAIService)
  const selectVoice = settingsStore((s) => s.selectVoice)
  const selectLanguage = settingsStore((s) => s.selectLanguage)
  const youtubeMode = settingsStore((s) => s.youtubeMode)
  const realtimeAPIMode = settingsStore((s) => s.realtimeAPIMode)
  const audioMode = settingsStore((s) => s.audioMode)
  const slideMode = settingsStore((s) => s.slideMode)
  const externalLinkageMode = settingsStore((s) => s.externalLinkageMode)
  const presenceDetectionEnabled = settingsStore(
    (s) => s.presenceDetectionEnabled
  )
  const idleModeEnabled = settingsStore((s) => s.idleModeEnabled)
  const kioskModeEnabled = settingsStore((s) => s.kioskModeEnabled)
  const gameCommentaryEnabled = settingsStore((s) => s.gameCommentaryEnabled)
  const isJa = i18n.language === 'ja'
  const modeItems = [
    { label: 'YouTube', active: youtubeMode },
    { label: 'Realtime API', active: realtimeAPIMode },
    { label: isJa ? '音声会話' : 'Voice chat', active: audioMode },
    { label: isJa ? 'スライド' : 'Slides', active: slideMode },
    { label: isJa ? '外部連携' : 'External', active: externalLinkageMode },
    {
      label: isJa ? '人感検知' : 'Presence',
      active: presenceDetectionEnabled,
    },
    { label: isJa ? 'アイドル' : 'Idle', active: idleModeEnabled },
    { label: isJa ? 'キオスク' : 'Kiosk', active: kioskModeEnabled },
    { label: isJa ? 'ゲーム実況' : 'Game', active: gameCommentaryEnabled },
  ]

  return (
    <header className="theme-surface-popover relative z-30 grid shrink-0 grid-cols-[auto_auto_1fr] items-center gap-3 border-b border-primary/20 px-3 py-3 backdrop-blur-sm sm:grid-cols-[auto_auto_auto_minmax(10rem,14rem)_1fr_auto] sm:px-4">
      <div className="z-15">
        <IconButton
          iconName="24/Close"
          isProcessing={false}
          aria-label={isJa ? '設定を閉じる' : 'Close settings'}
          onClick={onClickClose}
          data-testid="close-settings-button"
          backgroundColor="bg-transparent hover:bg-primary/10 active:bg-primary/15 disabled:bg-transparent"
          iconColor="text-text1"
          className="border border-primary/15 shadow-sm"
        ></IconButton>
      </div>
      <span
        className="h-7 w-7 shrink-0 bg-primary opacity-90"
        style={{
          WebkitMask:
            'url(/images/setting-icons/logo2-2favicon.svg) center / contain no-repeat',
          mask: 'url(/images/setting-icons/logo2-2favicon.svg) center / contain no-repeat',
        }}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <h1 className="text-lg font-bold leading-tight text-text1">
          {isJa ? '設定' : 'Settings'}
        </h1>
        <div className="text-xs text-text-primary/80">AITuberKit</div>
      </div>
      <label className="theme-surface-control order-3 col-span-3 flex h-10 items-center gap-2 rounded-lg border px-3 text-sm text-text1 sm:order-none sm:col-span-1">
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center text-text-primary"
          aria-hidden="true"
        >
          <pixiv-icon name="24/Text" scale="1" />
        </span>
        <select
          aria-label={isJa ? '表示言語' : 'Display language'}
          className="min-w-0 flex-1 bg-transparent font-bold outline-none"
          value={selectLanguage}
          onChange={(event) => {
            const language = event.target.value as Language
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
      </label>
      <div className="order-4 col-span-3 sm:order-none sm:col-span-1">
        <SettingsSearch />
      </div>
      <div className="hidden items-center gap-2 lg:flex">
        <StatusChip label="AI" value={formatStatusValue(selectAIService)} />
        <StatusChip
          label={isJa ? '音声' : 'Voice'}
          value={formatStatusValue(selectVoice)}
        />
        <ModeStatusSummary items={modeItems} isJa={isJa} />
        <a
          className="theme-surface-contrast flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-bold shadow-sm transition-colors"
          draggable={false}
          href="https://github.com/tegnike/aituber-kit"
          rel="noopener noreferrer"
          target="_blank"
        >
          <Image
            alt="GitHub Repository Link"
            height={18}
            width={18}
            src="/github-mark-white.svg"
          />
          GitHub
        </a>
      </div>
    </header>
  )
}

type ModeStatusItem = {
  label: string
  active: boolean
}

// タブの定義
type TabKey =
  | 'quickStart'
  | 'description'
  | 'based'
  | 'character'
  | 'ai'
  | 'voice'
  | 'youtube'
  | 'slide'
  | 'images'
  | 'memory'
  | 'presence'
  | 'idle'
  | 'gameCommentary'
  | 'kiosk'
  | 'other'
  | 'speechInput'

// アイコンのパスマッピング
const tabIconMapping: Record<TabKey, string> = {
  quickStart: '/images/setting-icons/basic-settings.svg',
  description: '/images/setting-icons/description.svg',
  based: '/images/setting-icons/basic-settings.svg',
  character: '/images/setting-icons/character-settings.svg',
  ai: '/images/setting-icons/ai-settings.svg',
  voice: '/images/setting-icons/voice-settings.svg',
  youtube: '/images/setting-icons/youtube-settings.svg',
  slide: '/images/setting-icons/slide-settings.svg',
  images: '/images/setting-icons/image-settings.svg',
  memory: '/images/setting-icons/memory-settings.svg',
  presence: '/images/setting-icons/presence-settings.svg',
  idle: '/images/setting-icons/idle-settings.svg',
  gameCommentary: '/images/setting-icons/gamecommentary-settings.svg',
  kiosk: '/images/setting-icons/kiosk-settings.svg',
  other: '/images/setting-icons/other-settings.svg',
  speechInput: '/images/setting-icons/microphone-settings.svg',
}

type TabConfig = {
  key: TabKey
  label: string
  keywords?: string[]
}

type TabGroup = {
  key: string
  label: string
  tabs: TabConfig[]
}

const SettingsSearch = () => {
  const { i18n } = useTranslation()
  const searchQuery = menuStore((state) => state.settingsSearchQuery)
  const searchLabel = i18n.language === 'ja' ? '設定を検索' : 'Search settings'
  const clearLabel = i18n.language === 'ja' ? '検索をクリア' : 'Clear search'

  return (
    <div className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-text-primary">
        <pixiv-icon name="24/Search" scale="1" />
      </span>
      <input
        className="theme-surface-control h-10 w-full rounded-lg border py-2 pl-10 pr-11 text-sm text-text1 outline-none transition"
        placeholder={searchLabel}
        value={searchQuery}
        aria-label={searchLabel}
        data-testid="settings-search-input"
        onChange={(event) =>
          menuStore.setState({
            settingsSearchQuery: event.target.value,
          })
        }
      />
      {searchQuery && (
        <button
          type="button"
          aria-label={clearLabel}
          title={clearLabel}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-text-primary transition-colors hover:bg-primary/10 hover:text-text1 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
          onClick={() =>
            menuStore.setState({
              settingsSearchQuery: '',
            })
          }
        >
          <pixiv-icon name="24/Close" scale="1" />
        </button>
      )}
    </div>
  )
}

const formatStatusValue = (value: string) =>
  value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const StatusChip = ({
  label,
  value,
  emphasized = false,
}: {
  label: string
  value: string
  emphasized?: boolean
}) => {
  return (
    <div
      className={`inline-flex h-8 max-w-44 items-center gap-1 rounded-full border px-3 text-xs ${
        emphasized
          ? 'theme-surface-soft text-primary'
          : 'theme-surface-control text-text-primary'
      }`}
    >
      <span className="shrink-0">{label}</span>
      <strong className="truncate text-text1">{value}</strong>
    </div>
  )
}

const ModeStatusSummary = ({
  items,
  isJa,
}: {
  items: ModeStatusItem[]
  isJa: boolean
}) => {
  const activeItems = items.filter((item) => item.active)
  const visibleActiveItems = activeItems.slice(0, 2)
  const hasMoreActiveItems = activeItems.length > visibleActiveItems.length
  const summaryLabel =
    activeItems.length === 0
      ? isJa
        ? '全OFF'
        : 'All off'
      : `${visibleActiveItems.map((item) => item.label).join(' / ')}${
          hasMoreActiveItems ? ' ...' : ''
        }`
  const modeLabel = isJa ? 'モード' : 'Modes'

  return (
    <details className="group relative">
      <summary className="theme-surface-control inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-full border px-3 text-xs text-text-primary transition-colors hover:border-primary/35 hover:text-text1 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1">
          {activeItems.length > 0 && (
            <span
              className="h-2 w-2 rounded-full bg-primary"
              aria-hidden="true"
            />
          )}
          <span className="shrink-0">{modeLabel}</span>
        </span>
        <strong className="max-w-36 truncate text-text1">{summaryLabel}</strong>
      </summary>
      <div className="theme-surface-popover absolute right-0 top-10 z-50 hidden max-h-[calc(100vh-6rem)] w-64 overflow-y-auto rounded-xl border border-primary/20 p-3 text-xs shadow-xl group-open:block">
        <div className="mb-2 font-bold text-text1">
          {isJa ? 'モード状態' : 'Mode status'}
        </div>
        <div className="space-y-1.5">
          {items.map((item) => (
            <div
              key={item.label}
              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 ${
                item.active
                  ? 'border-primary/30 bg-primary/10 text-text1'
                  : 'border-primary/10 bg-white/45 text-text-primary'
              }`}
            >
              <span className="truncate font-bold">{item.label}</span>
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  item.active
                    ? 'bg-primary text-theme'
                    : 'bg-text-primary/10 text-text-primary'
                }`}
              >
                {item.active ? 'ON' : 'OFF'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}

const getTabGroups = (
  t: (key: string) => string,
  isJa: boolean
): TabGroup[] => [
  {
    key: 'start',
    label: isJa ? 'はじめに' : 'Start',
    tabs: [
      {
        key: 'quickStart',
        label: isJa ? 'かんたん設定' : 'Easy setup',
        keywords: [
          'start',
          'easy',
          'beginner',
          'setup',
          'quick',
          'first',
          'character',
          'ai',
          'voice',
          'message',
          '初心者',
          'かんたん',
          '簡単',
          '最初',
          'はじめ',
          'セットアップ',
          'キャラクター',
          '音声',
          'メッセージ',
        ],
      },
      {
        key: 'character',
        label: t('CharacterSettings'),
        keywords: [
          'character',
          'prompt',
          'vrm',
          'live2d',
          'pngtuber',
          'キャラクター',
          'プロンプト',
          'モデル',
          '見た目',
          '名前',
        ],
      },
    ],
  },
  {
    key: 'conversation',
    label: isJa ? '会話' : 'Conversation',
    tabs: [
      {
        key: 'ai',
        label: t('AISettings'),
        keywords: [
          t('SelectModel'),
          t('MaxTokens'),
          t('MaxPastMessages'),
          t('ConversationHistory'),
          'ai',
          'llm',
          'model',
          'token',
          'message',
          'messages',
          'history',
          'chat',
          'モデル',
          'トークン',
          'メッセージ',
          '履歴',
        ],
      },
      {
        key: 'memory',
        label: t('MemorySettings'),
        keywords: [
          t('MaxPastMessages'),
          t('ConversationHistory'),
          'memory',
          'embedding',
          'message',
          'messages',
          'history',
          'chat',
          '記憶',
          'メッセージ',
          '履歴',
          '会話',
        ],
      },
    ],
  },
  {
    key: 'voiceInput',
    label: isJa ? '声・入力' : 'Voice & Input',
    tabs: [
      {
        key: 'voice',
        label: t('VoiceSettings'),
        keywords: ['voice', 'tts', 'speaker', '音声', '話者', '読み上げ', '声'],
      },
      {
        key: 'speechInput',
        label: t('SpeechInputSettings'),
        keywords: [
          'speech',
          'input',
          'stt',
          'microphone',
          '音声',
          '入力',
          'マイク',
          '聞く',
        ],
      },
    ],
  },
  {
    key: 'streaming',
    label: isJa ? '配信・表示' : 'Streaming & View',
    tabs: [
      {
        key: 'based',
        label: isJa ? '表示設定' : 'Display settings',
        keywords: [
          'display',
          'basic',
          'language',
          'theme',
          'background',
          'assistant text',
          'control panel',
          '表示',
          '基本',
          '言語',
          'テーマ',
          '背景',
          'アシスタントテキスト',
          'コントロールパネル',
        ],
      },
      {
        key: 'youtube',
        label: t('YoutubeSettings'),
        keywords: ['youtube', 'comment', 'stream', '配信', 'コメント'],
      },
      {
        key: 'gameCommentary',
        label: t('GameCommentarySettings'),
        keywords: ['game', 'commentary', '実況', 'ゲーム', 'コメント'],
      },
      {
        key: 'slide',
        label: t('SlideSettings'),
        keywords: ['slide', 'presentation', 'スライド', 'プレゼン'],
      },
      {
        key: 'images',
        label: t('ImageSettings'),
        keywords: ['image', 'layer', '画像', 'レイヤー'],
      },
    ],
  },
  {
    key: 'automation',
    label: isJa ? '自動化' : 'Automation',
    tabs: [
      {
        key: 'presence',
        label: t('PresenceSettings'),
        keywords: ['presence', 'camera', 'face', '人感', 'カメラ', '顔検出'],
      },
      {
        key: 'idle',
        label: t('IdleSettings'),
        keywords: [
          t('IdlePhraseText'),
          'idle',
          'message',
          'phrase',
          'メッセージ',
          'フレーズ',
        ],
      },
      {
        key: 'kiosk',
        label: t('KioskSettings'),
        keywords: ['kiosk', 'demo', 'passcode', 'デモ', '端末', 'パスコード'],
      },
    ],
  },
  {
    key: 'system',
    label: isJa ? 'その他' : 'Other',
    tabs: [
      {
        key: 'other',
        label: isJa ? '詳細設定' : 'Advanced settings',
        keywords: ['system', 'debug', 'other', 'その他', 'システム', '詳細'],
      },
      {
        key: 'description',
        label: t('Description'),
        keywords: ['about', 'app', 'license', 'github', 'アプリ', '説明'],
      },
    ],
  },
]

const Main = () => {
  const { t, i18n } = useTranslation()
  const activeTab = menuStore((state) => state.activeSettingsTab)
  const searchQuery = menuStore((state) => state.settingsSearchQuery)
  const [activeMobileGroup, setActiveMobileGroup] = useState('start')
  const contentScrollRef = useRef<HTMLElement>(null)
  const settingsPanelRef = useRef<HTMLDivElement>(null)
  const isJa = i18n.language === 'ja'

  const setActiveTab = (tab: TabKey) => {
    menuStore.setState({ activeSettingsTab: tab })
  }

  const setActiveGroup = (group: TabGroup) => {
    setActiveMobileGroup(group.key)
    const defaultTab = group.tabs[0]?.key
    if (defaultTab) {
      setActiveTab(defaultTab)
    }
  }

  const groups = useMemo(() => getTabGroups(t, isJa), [t, isJa])
  const tabs = groups.flatMap((group) => group.tabs)
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const visibleGroups = useMemo(() => {
    if (!normalizedSearchQuery) return groups
    const searchTerms = normalizedSearchQuery.split(/\s+/).filter(Boolean)

    return groups
      .map((group) => ({
        ...group,
        tabs: group.tabs.filter((tab) => {
          const searchText = [tab.label, ...(tab.keywords ?? [])]
            .join(' ')
            .toLowerCase()

          return searchTerms.every((term) => searchText.includes(term))
        }),
      }))
      .filter((group) => group.tabs.length > 0)
  }, [groups, normalizedSearchQuery])
  const activeTabGroup =
    groups.find((group) => group.tabs.some((tab) => tab.key === activeTab))
      ?.key ?? activeMobileGroup
  const selectedMobileGroup = normalizedSearchQuery
    ? activeMobileGroup
    : activeTabGroup

  const visibleMobileTabs = normalizedSearchQuery
    ? visibleGroups.flatMap((group) => group.tabs)
    : (visibleGroups.find((group) => group.key === selectedMobileGroup)?.tabs ??
      visibleGroups[0]?.tabs ??
      [])

  const renderTabContent = () => {
    switch (activeTab) {
      case 'quickStart':
        return <QuickStart />
      case 'description':
        return <Description />
      case 'based':
        return <Based />
      case 'character':
        return <Character />
      case 'ai':
        return <AI />
      case 'voice':
        return <Voice />
      case 'youtube':
        return <YouTube />
      case 'slide':
        return <Slide />
      case 'images':
        return <Images />
      case 'memory':
        return <MemorySettings />
      case 'presence':
        return <PresenceSettings />
      case 'idle':
        return <IdleSettings />
      case 'gameCommentary':
        return <GameCommentarySettings />
      case 'kiosk':
        return <KioskSettings />
      case 'other':
        return <Other />
      case 'speechInput':
        return <SpeechInput />
    }
  }

  const currentTab = tabs.find((tab) => tab.key === activeTab)

  useEffect(() => {
    contentScrollRef.current?.scrollTo({ top: 0, left: 0 })
  }, [activeTab])

  useEffect(() => {
    const settingsPanel = settingsPanelRef.current
    if (!settingsPanel) return

    clearSearchHighlights(settingsPanel)

    const searchTerms = searchQuery.trim().split(/\s+/).filter(Boolean)
    if (searchTerms.length === 0) return

    highlightSearchTerms(settingsPanel, searchTerms)

    return () => {
      clearSearchHighlights(settingsPanel)
    }
  }, [activeTab, searchQuery])

  return (
    <main className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_1fr] text-text1 md:grid-cols-[260px_1fr] md:grid-rows-1">
      <aside className="theme-surface-popover hidden min-h-0 overflow-y-auto border-r border-primary/20 p-3 backdrop-blur-sm md:block">
        <nav aria-label="Settings navigation" className="space-y-4">
          {visibleGroups.map((group) => (
            <section key={group.key}>
              <div className="mb-1 px-2 text-xs font-bold text-text-primary/80">
                {group.label}
              </div>
              <ul className="space-y-1">
                {group.tabs.map((tab) => (
                  <li key={tab.key}>
                    <SettingsTabButton
                      active={activeTab === tab.key}
                      label={tab.label}
                      tabKey={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </aside>

      <div className="theme-surface-popover min-w-0 border-b border-primary/20 py-3 md:hidden">
        <div className="scroll-hidden flex gap-2 overflow-x-auto px-3 pb-3">
          {visibleGroups.map((group) => (
            <button
              key={group.key}
              className={`h-10 shrink-0 rounded-lg border px-4 text-sm font-bold shadow-sm ${
                selectedMobileGroup === group.key
                  ? 'border-primary bg-primary text-theme'
                  : 'theme-surface-control text-text1 hover:border-primary/50'
              }`}
              onClick={() => setActiveGroup(group)}
              data-testid={`settings-group-${group.key}`}
            >
              {group.label}
            </button>
          ))}
        </div>
        <div className="scroll-hidden flex gap-2 overflow-x-auto border-t border-primary/10 px-3 pt-3">
          {visibleMobileTabs.map((tab) => (
            <SettingsTabButton
              key={tab.key}
              active={activeTab === tab.key}
              compact
              label={tab.label}
              tabKey={tab.key}
              onClick={() => setActiveTab(tab.key)}
            />
          ))}
        </div>
      </div>

      <section
        ref={contentScrollRef}
        className="min-h-0 min-w-0 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5"
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {currentTab && (
                  <div
                    className="h-7 w-7 shrink-0 icon-mask-default"
                    style={{
                      maskImage: `url(${tabIconMapping[currentTab.key]})`,
                      maskSize: 'contain',
                      maskRepeat: 'no-repeat',
                      maskPosition: 'center',
                    }}
                  />
                )}
                <div className="text-2xl font-bold">{currentTab?.label}</div>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-primary/80">
                {isJa
                  ? '関連する設定だけをまとめて表示します。左のカテゴリまたは検索から目的の項目を選んでください。'
                  : 'Choose a category or search to find related settings quickly.'}
              </p>
            </div>
          </div>
          <div
            ref={settingsPanelRef}
            className="theme-surface-elevated rounded-xl border p-4 backdrop-blur-sm sm:p-6"
            data-testid="settings-panel"
          >
            <div
              className={
                tabsWithRedundantPanelTitle.has(activeTab)
                  ? 'settings-panel-content settings-panel-content--hide-title'
                  : 'settings-panel-content'
              }
            >
              {renderTabContent()}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

const SettingsTabButton = ({
  active,
  compact = false,
  label,
  onClick,
  tabKey,
}: {
  active: boolean
  compact?: boolean
  label: string
  onClick: () => void
  tabKey: TabKey
}) => {
  return (
    <button
      className={`flex items-center rounded-lg border text-left font-medium transition ${
        compact
          ? 'h-10 shrink-0 px-3 text-sm shadow-sm'
          : 'min-h-[38px] w-full px-3 py-2 text-sm'
      } ${
        active
          ? 'border-primary bg-primary text-theme'
          : 'border-transparent bg-transparent text-text1 hover:border-primary/30 hover:bg-primary/5'
      }`}
      onClick={onClick}
      data-testid={`settings-tab-${tabKey}`}
    >
      <div
        className={`mr-2 h-5 w-5 shrink-0 ${
          active ? 'icon-mask-active' : 'icon-mask-default'
        }`}
        style={{
          maskImage: `url(${tabIconMapping[tabKey]})`,
          maskSize: 'contain',
          maskRepeat: 'no-repeat',
          maskPosition: 'center',
        }}
      />
      <span className="truncate">{label}</span>
    </button>
  )
}

const clearSearchHighlights = (root: HTMLElement) => {
  root
    .querySelectorAll('mark[data-settings-search-highlight="true"]')
    .forEach((mark) => {
      const parent = mark.parentNode
      if (!parent) return

      parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark)
      parent.normalize()
    })
}

const highlightSearchTerms = (root: HTMLElement, searchTerms: string[]) => {
  const uniqueTerms = Array.from(
    new Set(searchTerms.map((term) => term.trim()).filter(Boolean))
  )
  if (uniqueTerms.length === 0) return

  const searchPattern = new RegExp(
    `(${uniqueTerms.map(escapeRegExp).join('|')})`,
    'gi'
  )
  const textNodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

  while (walker.nextNode()) {
    const node = walker.currentNode
    const parentElement = node.parentElement
    if (!parentElement || shouldSkipSearchHighlight(parentElement)) continue
    if (!node.textContent || !searchPattern.test(node.textContent)) continue

    textNodes.push(node as Text)
    searchPattern.lastIndex = 0
  }

  textNodes.forEach((node) => {
    const text = node.textContent ?? ''
    const fragment = document.createDocumentFragment()
    let lastIndex = 0

    text.replace(searchPattern, (match, _term, offset: number) => {
      if (offset > lastIndex) {
        fragment.appendChild(
          document.createTextNode(text.slice(lastIndex, offset))
        )
      }

      const mark = document.createElement('mark')
      mark.dataset.settingsSearchHighlight = 'true'
      mark.className = 'settings-search-highlight'
      mark.textContent = match
      fragment.appendChild(mark)
      lastIndex = offset + match.length
      return match
    })

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)))
    }

    node.replaceWith(fragment)
    searchPattern.lastIndex = 0
  })
}

const shouldSkipSearchHighlight = (element: Element) =>
  Boolean(
    element.closest(
      'input, textarea, select, option, script, style, mark[data-settings-search-highlight="true"]'
    )
  )

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const Footer = () => {
  return (
    <footer className="theme-surface-contrast shrink-0 border-t border-primary/20 py-1 text-center font-Montserrat text-xs">
      powered by ChatVRM from Pixiv / ver. 2.46.0
    </footer>
  )
}
