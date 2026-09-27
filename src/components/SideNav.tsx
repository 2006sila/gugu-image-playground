/**
 * 融合版左侧导航栏（宽屏 ≥xl 显示）
 * Nova 宽屏垂直气泡 Tab 风格：Logo + 主模式 + 融合功能 + 设置。
 * 窄屏时隐藏，由 Header 现有布局接管。
 */

import { useStore } from '../store'
import {
  ScanSearchIcon,
  BookIcon,
  FilmIcon,
  CanvasIcon,
  SettingsIcon,
  ImagesIcon,
  BotIcon,
} from './icons'

interface NavItem {
  key: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  active: boolean
}

export default function SideNav() {
  const appMode = useStore((s) => s.appMode)
  const setAppMode = useStore((s) => s.setAppMode)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const fusionModal = useStore((s) => s.fusionModal)
  const setFusionModal = useStore((s) => s.setFusionModal)

  const mainItems: NavItem[] = [
    { key: 'gallery', icon: ImagesIcon, label: '画廊', onClick: () => setAppMode('gallery'), active: appMode === 'gallery' },
    { key: 'agent', icon: BotIcon, label: 'Agent', onClick: () => setAppMode('agent'), active: appMode === 'agent' },
  ]

  const toolItems: NavItem[] = [
    { key: 'reverse', icon: ScanSearchIcon, label: '反推提示词', onClick: () => setFusionModal('reverse'), active: fusionModal === 'reverse' },
    { key: 'canvas', icon: CanvasIcon, label: '无限画布', onClick: () => setFusionModal('canvas'), active: fusionModal === 'canvas' },
    { key: 'gif', icon: FilmIcon, label: 'GIF 生成', onClick: () => setFusionModal('gif'), active: fusionModal === 'gif' },
    { key: 'promptPanel', icon: BookIcon, label: '提示词库', onClick: () => setFusionModal('promptPanel'), active: fusionModal === 'promptPanel' },
    { key: 'assets', icon: ImagesIcon, label: '我的素材', onClick: () => setFusionModal('assets'), active: fusionModal === 'assets' },
  ]

  const renderItem = (item: NavItem) => (
    <button
      key={item.key}
      onClick={item.onClick}
      className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 ${
        item.active
          ? 'bg-sky-500/10 text-sky-600 shadow-sm ring-1 ring-sky-500/20 dark:text-sky-400'
          : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-200'
      }`}
    >
      <item.icon className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  )

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-full w-56 flex-col border-r border-gray-200/70 bg-white/80 backdrop-blur-xl dark:border-white/[0.06] dark:bg-gray-950/80 xl:flex">
      {/* Logo */}
      <div className="px-4 pb-2 pt-5">
        <h1 className="fusion-brand-gradient text-lg font-extrabold tracking-tight">gugu image playground</h1>
        <p className="mt-0.5 text-[11px] text-zinc-400">AI 图像生成工作台</p>
      </div>

      {/* 主模式 */}
      <nav className="flex flex-col gap-0.5 px-3 pt-2">{mainItems.map(renderItem)}</nav>

      {/* 分隔线 */}
      <div className="mx-4 my-3 border-t border-gray-200/70 dark:border-white/[0.06]" />
      <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">工具</p>
      <nav className="flex flex-1 flex-col gap-0.5 px-3">{toolItems.map(renderItem)}</nav>

      {/* 底部设置 */}
      <div className="border-t border-gray-200/70 p-3 dark:border-white/[0.06]">
        <button
          onClick={() => setShowSettings(true)}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-200"
        >
          <SettingsIcon className="h-[18px] w-[18px] shrink-0" />
          <span>设置</span>
        </button>
      </div>
    </aside>
  )
}
