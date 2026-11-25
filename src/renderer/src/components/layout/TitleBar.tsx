/** Frameless window: an empty drag strip with the window controls. */
export default function TitleBar() {
  return (
    <div className="titlebar">
      <div className="titlebar__controls">
        <button
          className="win-btn"
          title="Minimizar"
          aria-label="Minimizar"
          onClick={() => window.api.system.minimizeWindow()}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <rect fill="currentColor" width="10" height="1" x="1" y="6" />
          </svg>
        </button>
        <button
          className="win-btn"
          title="Maximizar"
          aria-label="Maximizar"
          onClick={() => window.api.system.maximizeWindow()}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <rect fill="none" stroke="currentColor" width="9" height="9" x="1.5" y="1.5" />
          </svg>
        </button>
        <button
          className="win-btn win-btn--close"
          title="Cerrar"
          aria-label="Cerrar"
          onClick={() => window.api.system.closeWindow()}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path
              fill="currentColor"
              d="M11 1.576L6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1z"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
