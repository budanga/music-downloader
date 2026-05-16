export default function TitleBar() {
  const minimize = () => window.api?.system?.minimizeWindow?.()
  const maximize = () => window.api?.system?.maximizeWindow?.()
  const close = () => window.api?.system?.closeWindow?.()
  
  return (
    <div className="titlebar">
      <span className="titlebar__logo">♫</span>
      <span>Music Downloader</span>
      <div className="titlebar__controls">
        <button className="win-btn win-btn--min" title="Minimize" onClick={minimize}>
          <svg width="12" height="12" viewBox="0 0 12 12"><rect fill="currentColor" width="10" height="1" x="1" y="6"/></svg>
        </button>
        <button className="win-btn win-btn--max" title="Maximize" onClick={maximize}>
          <svg width="12" height="12" viewBox="0 0 12 12"><rect fill="none" stroke="currentColor" width="9" height="9" x="1.5" y="1.5"/></svg>
        </button>
        <button className="win-btn win-btn--close" title="Close" onClick={close}>
          <svg width="12" height="12" viewBox="0 0 12 12"><path fill="currentColor" d="M11 1.576L6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1z"/></svg>
        </button>
      </div>
    </div>
  )
}
