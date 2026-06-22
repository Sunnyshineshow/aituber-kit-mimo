import type { ReactNode } from 'react'

type DisabledSettingNoteProps = {
  children: ReactNode
  show?: boolean
}

export const DisabledSettingNote = ({
  children,
  show = true,
}: DisabledSettingNoteProps) => {
  if (!show) return null

  return (
    <div className="my-3 text-sm text-secondary whitespace-pre-line">
      {children}
    </div>
  )
}
