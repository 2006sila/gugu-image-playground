/**
 * 反推提示词入口包装：从 store 取文本模型配置与主输入栏回填
 */
import { useStore } from '../store'
import ReversePromptModal from './fusion/ReversePromptModal'
import { loadTextModels, loadTextDefaults, type TextModelConfig, type TextDefaults } from '../lib/textModels'

export default function ReversePromptEntry({ onClose }: { onClose: () => void }) {
  const models: TextModelConfig[] = loadTextModels()
  const defaults: TextDefaults = loadTextDefaults()

  const adopt = (prompt: string) => {
    useStore.getState().setPrompt(prompt)
  }

  return (
    <ReversePromptModal
      open
      onClose={onClose}
      onAdopt={adopt}
      textModels={models}
      textDefaults={defaults}
    />
  )
}
