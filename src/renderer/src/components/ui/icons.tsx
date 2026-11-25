/** Stroke icons sized and coloured by the surrounding CSS (.ib svg, .ctl svg…). */
const I = ({ d, fill }: { d: string; fill?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    style={fill ? { fill: 'currentColor', stroke: 'none' } : undefined}
  >
    <path d={d} />
  </svg>
)

export const HeartIcon = () => (
  <I d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z" />
)
export const QueueIcon = () => <I d="M3 6h12M3 12h12M3 18h8M18 15v6M15 18h6" />
export const ListIcon = () => <I d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />
export const PlusIcon = () => <I d="M12 5v14M5 12h14" />
export const DotsIcon = () => (
  <I
    d="M12 7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm0 6.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm0 6.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"
    fill
  />
)
export const XIcon = () => <I d="M6 6l12 12M18 6 6 18" />
export const PlayIcon = () => <I d="M7 4.5v15l12-7.5z" fill />
export const PauseIcon = () => <I d="M6 4h4v16H6zM14 4h4v16h-4z" fill />
export const PrevIcon = () => <I d="M19 20 9 12l10-8v16zM5 19V5" />
export const NextIcon = () => <I d="m5 4 10 8-10 8V4zM19 5v14" />
export const ShuffleIcon = () => <I d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
export const RepeatIcon = () => (
  <I d="m17 1 4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />
)
export const VolumeIcon = () => (
  <I d="M11 5 6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
)
export const MuteIcon = () => <I d="M11 5 6 9H2v6h4l5 4V5zM22 9l-6 6M16 9l6 6" />
export const SearchIcon = () => <I d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5" />
export const FolderIcon = () => (
  <I d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
)
export const TrashIcon = () => (
  <I d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
)
export const CheckIcon = () => <I d="M5 12.5l4.5 4.5L19 7.5" />
export const AlertIcon = () => <I d="M12 8v5M12 16.5h.01M12 3 2 21h20z" />
