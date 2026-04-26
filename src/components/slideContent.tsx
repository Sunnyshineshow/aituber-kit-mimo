import React from 'react'

interface SlideContentProps {
  marpitContainer: Element | null
}

const SlideContent: React.FC<SlideContentProps> = ({ marpitContainer }) => {
  return (
    <div data-testid="slide-content" style={{ border: '2px solid #333' }}>
      {marpitContainer && (
        <div
          data-testid="slide-marpit-container"
          style={{ width: '100%', height: '100%', overflow: 'hidden' }}
          dangerouslySetInnerHTML={{ __html: marpitContainer.outerHTML }}
        />
      )}
    </div>
  )
}

export default SlideContent
