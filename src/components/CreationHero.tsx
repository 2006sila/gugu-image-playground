/**
 * 居中创作台（融合版空态）
 * 借鉴 Midjourney / 即梦的"空态即工作台"布局：
 * 大 Logo 标题 + 大号功能卡片 + 快捷提示词 chips。
 * 生成历史出现后此组件让位给画廊网格。
 */

import { useStore } from '../store'

interface Props {
  onOpen: (modal: 'reverse' | 'promptPanel' | 'gif' | 'canvas') => void
}

const TOOLS = [
  {
    key: 'reverse',
    emoji: '🔍',
    title: '反推提示词',
    desc: '传一张参考图，AI 反推出风格提示词',
    accent: 'from-sky-500 to-cyan-400',
  },
  {
    key: 'canvas',
    emoji: '🎨',
    title: '无限画布',
    desc: '多图迭代编排，连线生成，空间化创作',
    accent: 'from-violet-500 to-fuchsia-400',
  },
  {
    key: 'gif',
    emoji: '🎬',
    title: 'GIF 动图',
    desc: '一句话生成 12 帧动画，导出表情包',
    accent: 'from-amber-500 to-orange-400',
  },
  {
    key: 'promptPanel',
    emoji: '📚',
    title: '提示词库',
    desc: '灵感广场 + 你的素材收藏',
    accent: 'from-emerald-500 to-teal-400',
  },
] as const

const QUICK_PROMPTS = [
  '电影感雨夜街头人像，霓虹灯倒影，35mm 胶片质感',
  '吉卜力水彩风格的山间小镇，夏日午后，治愈氛围',
  '赛博朋克未来都市鸟瞰，飞行器光轨，全息广告',
  '极简商务肖像，侧面柔光，高级质感',
]

export default function CreationHero() {
  const setPrompt = useStore((s) => s.setPrompt)
  const setFusionModal = useStore((s) => s.setFusionModal)

  return (
    <div className="fusion-modal-enter mx-auto max-w-3xl px-4 pb-4 pt-10 text-center sm:pt-16">
      {/* 品牌区 */}
      <div className="mb-8">
        <div
          className="hero-glow mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl text-3xl font-black text-white"
          style={{ background: 'linear-gradient(135deg, #0284C7, #38BDF8)' }}
        >
          ✦
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100 sm:text-3xl">
          想画点什么？
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          在下方输入提示词开始创作，或选择一个工具
        </p>
      </div>

      {/* 功能卡片 2×2 */}
      <div className="mb-6 grid grid-cols-2 gap-3 text-left sm:gap-4">
        {TOOLS.map((tool) => (
          <button
            key={tool.key}
            onClick={() => setFusionModal(tool.key)}
            className="tool-card group relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/70 p-4 text-left backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_12px_40px_rgba(14,165,233,0.15)] dark:border-white/[0.06] dark:bg-white/[0.03] sm:p-5"
          >
            {/* 悬停渐变光晕 */}
            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tool.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-[0.06]`}
            />
            <div
              className={`tool-icon mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${tool.accent} text-lg shadow-md`}
            >
              {tool.emoji}
            </div>
            <div className="mb-1 flex items-center justify-between text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              {tool.title}
              <span className="tool-arrow text-sky-500">→</span>
            </div>
            <div className="text-xs leading-relaxed text-zinc-400">{tool.desc}</div>
          </button>
        ))}
      </div>

      {/* 快捷提示词 chips */}
      <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs text-zinc-400">试试：</span>
        {QUICK_PROMPTS.map((p, i) => (
          <button
            key={i}
            onClick={() => setPrompt(p)}
            style={{ animationDelay: `${0.15 + i * 0.08}s` }}
            className="chip-in max-w-full truncate rounded-full border border-zinc-200 bg-white/60 px-3.5 py-1.5 text-xs text-zinc-600 backdrop-blur transition-all hover:border-sky-400 hover:text-sky-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:border-sky-500/50 dark:hover:text-sky-400"
          >
            {p.length > 24 ? p.slice(0, 24) + '…' : p}
          </button>
        ))}
      </div>
    </div>
  )
}
