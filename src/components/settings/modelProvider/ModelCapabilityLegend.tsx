import { useTranslation } from 'react-i18next'

export const ModelCapabilityLegend = () => {
  const { t } = useTranslation()

  return (
    <div className="mt-2 text-xs text-theme-default opacity-70 whitespace-pre-wrap">
      {t('ModelCapabilityLegend')}
    </div>
  )
}
