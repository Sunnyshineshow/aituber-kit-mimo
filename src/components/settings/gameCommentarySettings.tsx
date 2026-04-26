/**
 * GameCommentarySettings Component
 *
 * ゲーム実況モード機能の設定UIを提供
 */

import { useTranslation } from 'react-i18next'
import settingsStore from '@/features/stores/settings'
import homeStore from '@/features/stores/home'
import { ToggleSwitch } from '../toggleSwitch'
import {
  clampBackgroundAnalysisInterval,
  clampCaptureInterval,
  clampContextCount,
  GAME_COMMENTARY_BACKGROUND_ANALYSIS_INTERVAL,
  GAME_COMMENTARY_INTERVAL,
  GAME_COMMENTARY_CONTEXT_COUNT,
  GAME_COMMENTARY_VIDEO_DELAY,
} from '@/features/gameCommentary/gameCommentaryTypes'
import { isMultiModalModel } from '@/features/constants/aiModels'

const RESIZE_WIDTH_OPTIONS = [
  { value: 512, label: '512px' },
  { value: 768, label: '768px' },
  { value: 1024, label: '1024px' },
  { value: 0, label: '' }, // label is set from translation
]

const GameCommentarySettings = () => {
  const { t } = useTranslation()

  // Settings store state
  const gameCommentaryEnabled = settingsStore((s) => s.gameCommentaryEnabled)
  const gameCommentaryCaptureInterval = settingsStore(
    (s) => s.gameCommentaryCaptureInterval
  )
  const gameCommentaryContextCount = settingsStore(
    (s) => s.gameCommentaryContextCount
  )
  const gameCommentaryPromptTemplate = settingsStore(
    (s) => s.gameCommentaryPromptTemplate
  )
  const gameCommentaryBackgroundAnalysisPromptTemplate = settingsStore(
    (s) => s.gameCommentaryBackgroundAnalysisPromptTemplate
  )
  const gameCommentaryImageQuality = settingsStore(
    (s) => s.gameCommentaryImageQuality
  )
  const gameCommentaryResizeWidth = settingsStore(
    (s) => s.gameCommentaryResizeWidth
  )
  const gameCommentarySaveToChat = settingsStore(
    (s) => s.gameCommentarySaveToChat
  )
  const gameCommentaryVideoDelay = settingsStore(
    (s) => s.gameCommentaryVideoDelay
  )
  const gameCommentaryBackgroundAnalysisEnabled = settingsStore(
    (s) => s.gameCommentaryBackgroundAnalysisEnabled
  )
  const gameCommentaryBackgroundAnalysisInterval = settingsStore(
    (s) => s.gameCommentaryBackgroundAnalysisInterval
  )

  // 排他制御による無効化判定
  const realtimeAPIMode = settingsStore((s) => s.realtimeAPIMode)
  const audioMode = settingsStore((s) => s.audioMode)
  const externalLinkageMode = settingsStore((s) => s.externalLinkageMode)
  const idleModeEnabled = settingsStore((s) => s.idleModeEnabled)
  const slideMode = settingsStore((s) => s.slideMode)
  const presenceDetectionEnabled = settingsStore(
    (s) => s.presenceDetectionEnabled
  )
  const isDisabledByExclusion =
    realtimeAPIMode ||
    audioMode ||
    externalLinkageMode ||
    idleModeEnabled ||
    slideMode ||
    presenceDetectionEnabled

  // マルチモーダル対応チェック
  const selectAIService = settingsStore((s) => s.selectAIService)
  const selectAIModel = settingsStore((s) => s.selectAIModel)
  const isMultiModal = isMultiModalModel(selectAIService, selectAIModel)

  // キャプチャ状態チェック
  const captureStatus = homeStore((s) => s.captureStatus)

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center mb-6">
          <div
            className="w-6 h-6 mr-2 icon-mask-default"
            style={{
              maskImage:
                'url(/images/setting-icons/gamecommentary-settings.svg)',
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
            }}
          />
          <h2 className="text-2xl font-bold">{t('GameCommentarySettings')}</h2>
        </div>

        {/* ON/OFFトグル */}
        <div className="my-6">
          <div className="my-4 text-xl font-bold">
            {t('GameCommentary.Enable')}
          </div>
          <div className="my-2 text-sm whitespace-pre-wrap">
            {t('GameCommentary.EnableInfo')}
          </div>
          {isDisabledByExclusion && (
            <div className="my-4 text-sm text-orange-500 whitespace-pre-line">
              {t('GameCommentary.DisabledByExclusion')}
            </div>
          )}
          {!isMultiModal && (
            <div className="my-4 text-sm text-orange-500 whitespace-pre-line">
              {t('GameCommentary.NonMultiModalWarning')}
            </div>
          )}
          {!captureStatus && (
            <div className="my-4 text-sm text-orange-500 whitespace-pre-line">
              {t('GameCommentary.NoCaptureWarning')}
            </div>
          )}
          <div className="my-2">
            <ToggleSwitch
              enabled={gameCommentaryEnabled}
              onChange={(v) =>
                settingsStore.setState(
                  v
                    ? { gameCommentaryEnabled: true }
                    : {
                        gameCommentaryEnabled: false,
                        gameCommentaryPlaying: false,
                      }
                )
              }
              disabled={isDisabledByExclusion}
            />
          </div>
        </div>

        {/* API料金注意喚起 */}
        <div className="my-4 text-sm text-orange-500 whitespace-pre-line">
          {t('GameCommentary.ApiCostWarning')}
        </div>

        {/* キャプチャ間隔 */}
        <div className="my-6">
          <div className="my-4 text-xl font-bold">
            {t('GameCommentary.CaptureInterval')}
          </div>
          <div className="my-2 text-sm whitespace-pre-wrap">
            {t('GameCommentary.CaptureIntervalInfo', {
              min: GAME_COMMENTARY_INTERVAL.MIN,
              max: GAME_COMMENTARY_INTERVAL.MAX,
            })}
          </div>
          <div className="my-4 flex items-center gap-4">
            <input
              type="range"
              min={GAME_COMMENTARY_INTERVAL.MIN}
              max={GAME_COMMENTARY_INTERVAL.MAX}
              step={1}
              value={gameCommentaryCaptureInterval}
              onChange={(e) =>
                settingsStore.setState({
                  gameCommentaryCaptureInterval: parseInt(e.target.value, 10),
                })
              }
              className="flex-1"
            />
            <span className="w-16 text-right">
              {gameCommentaryCaptureInterval}s
            </span>
          </div>
        </div>

        {/* 映像遅延 */}
        <div className="my-6">
          <div className="my-4 text-xl font-bold">
            {t('GameCommentary.VideoDelay')}
          </div>
          <div className="my-2 text-sm whitespace-pre-wrap">
            {t('GameCommentary.VideoDelayInfo', {
              min: GAME_COMMENTARY_VIDEO_DELAY.MIN,
              max: GAME_COMMENTARY_VIDEO_DELAY.MAX,
            })}
          </div>
          <div className="my-4 flex items-center gap-4">
            <input
              type="range"
              min={GAME_COMMENTARY_VIDEO_DELAY.MIN}
              max={GAME_COMMENTARY_VIDEO_DELAY.MAX}
              step={1}
              value={gameCommentaryVideoDelay}
              onChange={(e) =>
                settingsStore.setState({
                  gameCommentaryVideoDelay: parseInt(e.target.value, 10),
                })
              }
              className="flex-1"
            />
            <span className="w-16 text-right">
              {gameCommentaryVideoDelay === 0
                ? t('GameCommentary.VideoDelayOff')
                : `${gameCommentaryVideoDelay}s`}
            </span>
          </div>
        </div>

        {/* 画像品質 */}
        <div className="my-6">
          <div className="my-4 text-xl font-bold">
            {t('GameCommentary.ImageQuality')}
          </div>
          <div className="my-2 text-sm whitespace-pre-wrap">
            {t('GameCommentary.ImageQualityInfo', {
              min: '0.3',
              max: '1.0',
            })}
          </div>
          <div className="my-4 flex items-center gap-4">
            <input
              type="range"
              min={0.3}
              max={1.0}
              step={0.1}
              value={gameCommentaryImageQuality}
              onChange={(e) =>
                settingsStore.setState({
                  gameCommentaryImageQuality: parseFloat(e.target.value),
                })
              }
              className="flex-1"
            />
            <span className="w-16 text-right">
              {gameCommentaryImageQuality.toFixed(1)}
            </span>
          </div>
        </div>

        {/* 画像リサイズ幅 */}
        <div className="my-6">
          <div className="my-4 text-xl font-bold">
            {t('GameCommentary.ResizeWidth')}
          </div>
          <div className="my-2 text-sm whitespace-pre-wrap">
            {t('GameCommentary.ResizeWidthInfo')}
          </div>
          <div className="my-4">
            <select
              value={gameCommentaryResizeWidth}
              onChange={(e) =>
                settingsStore.setState({
                  gameCommentaryResizeWidth: parseInt(e.target.value, 10),
                })
              }
              className="w-auto px-4 py-2 bg-white border border-gray-300 rounded-lg"
            >
              {RESIZE_WIDTH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value === 0
                    ? t('GameCommentary.ResizeWidthNone')
                    : opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 文脈メッセージ数 */}
        <div className="my-6">
          <div className="my-4 text-xl font-bold">
            {t('GameCommentary.ContextCount')}
          </div>
          <div className="my-2 text-sm whitespace-pre-wrap">
            {t('GameCommentary.ContextCountInfo', {
              min: GAME_COMMENTARY_CONTEXT_COUNT.MIN,
              max: GAME_COMMENTARY_CONTEXT_COUNT.MAX,
            })}
          </div>
          <div className="my-4 flex items-center gap-2">
            <input
              type="number"
              min={GAME_COMMENTARY_CONTEXT_COUNT.MIN}
              max={GAME_COMMENTARY_CONTEXT_COUNT.MAX}
              value={gameCommentaryContextCount}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10)
                if (!isNaN(value)) {
                  settingsStore.setState({
                    gameCommentaryContextCount: value,
                  })
                }
              }}
              onBlur={(e) => {
                const value = parseInt(e.target.value, 10)
                if (!isNaN(value)) {
                  settingsStore.setState({
                    gameCommentaryContextCount: clampContextCount(value),
                  })
                }
              }}
              className="w-24 px-4 py-2 bg-white border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        {/* 実況プロンプト */}
        <div className="my-6">
          <div className="my-4 text-xl font-bold">
            {t('GameCommentary.PromptTemplate')}
          </div>
          <div className="my-2 text-sm whitespace-pre-wrap">
            {t('GameCommentary.PromptTemplateInfo')}
          </div>
          <textarea
            value={gameCommentaryPromptTemplate}
            onChange={(e) =>
              settingsStore.setState({
                gameCommentaryPromptTemplate: e.target.value,
              })
            }
            className="w-full h-24 px-4 py-2 bg-white border border-gray-300 rounded-lg resize-y"
          />
        </div>

        {/* chatLogに保存するかトグル */}
        <div className="my-6">
          <div className="my-4 text-xl font-bold">
            {t('GameCommentary.SaveToChat')}
          </div>
          <div className="my-2 text-sm whitespace-pre-wrap">
            {t('GameCommentary.SaveToChatInfo')}
          </div>
          <div className="my-2">
            <ToggleSwitch
              enabled={gameCommentarySaveToChat}
              onChange={(v) =>
                settingsStore.setState({ gameCommentarySaveToChat: v })
              }
            />
          </div>
        </div>

        {/* 発話中の補助画像解析 */}
        <div className="my-6">
          <div className="my-4 text-xl font-bold">
            {t('GameCommentary.BackgroundAnalysis')}
          </div>
          <div className="my-2 text-sm whitespace-pre-wrap">
            {t('GameCommentary.BackgroundAnalysisInfo')}
          </div>
          <div className="my-2">
            <ToggleSwitch
              enabled={gameCommentaryBackgroundAnalysisEnabled}
              onChange={(v) =>
                settingsStore.setState({
                  gameCommentaryBackgroundAnalysisEnabled: v,
                })
              }
            />
          </div>
          <div className="my-6">
            <div className="my-4 text-xl font-bold">
              {t('GameCommentary.BackgroundAnalysisPromptTemplate')}
            </div>
            <div className="my-2 text-sm whitespace-pre-wrap">
              {t('GameCommentary.BackgroundAnalysisPromptTemplateInfo')}
            </div>
            <textarea
              value={gameCommentaryBackgroundAnalysisPromptTemplate}
              onChange={(e) =>
                settingsStore.setState({
                  gameCommentaryBackgroundAnalysisPromptTemplate:
                    e.target.value,
                })
              }
              className="w-full h-24 px-4 py-2 bg-white border border-gray-300 rounded-lg resize-y"
              disabled={!gameCommentaryBackgroundAnalysisEnabled}
            />
          </div>
          <div className="my-6">
            <div className="my-4 text-xl font-bold">
              {t('GameCommentary.BackgroundAnalysisInterval')}
            </div>
            <div className="my-2 text-sm whitespace-pre-wrap">
              {t('GameCommentary.BackgroundAnalysisIntervalInfo', {
                min: GAME_COMMENTARY_BACKGROUND_ANALYSIS_INTERVAL.MIN,
                max: GAME_COMMENTARY_BACKGROUND_ANALYSIS_INTERVAL.MAX,
              })}
            </div>
            <div className="my-4 flex items-center gap-4">
              <input
                type="range"
                min={GAME_COMMENTARY_BACKGROUND_ANALYSIS_INTERVAL.MIN}
                max={GAME_COMMENTARY_BACKGROUND_ANALYSIS_INTERVAL.MAX}
                step={1}
                value={gameCommentaryBackgroundAnalysisInterval}
                onChange={(e) =>
                  settingsStore.setState({
                    gameCommentaryBackgroundAnalysisInterval: parseInt(
                      e.target.value,
                      10
                    ),
                  })
                }
                onBlur={(e) =>
                  settingsStore.setState({
                    gameCommentaryBackgroundAnalysisInterval:
                      clampBackgroundAnalysisInterval(
                        parseInt(e.target.value, 10)
                      ),
                  })
                }
                className="flex-1"
                disabled={!gameCommentaryBackgroundAnalysisEnabled}
              />
              <span className="w-16 text-right">
                {gameCommentaryBackgroundAnalysisInterval}s
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default GameCommentarySettings
