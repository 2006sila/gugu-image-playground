import type { ApiProfile, AppSettings } from '../types'
import { getAgentImageApiProfile, getAgentTextApiProfile, validateApiProfile } from './apiProfiles'
import { resolveTextModel, type TextDefaults, type TextModelConfig } from './textModels'

export type CapabilityLevel = 'ready' | 'warning' | 'error'
export type CapabilityCheckState = 'pass' | 'info' | 'fail'

export interface CapabilityCheck {
  label: string
  state: CapabilityCheckState
  detail: string
}

export interface ModelCapabilityDiagnostic {
  level: CapabilityLevel
  title: string
  summary: string
  checks: CapabilityCheck[]
}

function readyCheck(label: string, detail: string): CapabilityCheck {
  return { label, detail, state: 'pass' }
}

function infoCheck(label: string, detail: string): CapabilityCheck {
  return { label, detail, state: 'info' }
}

function failCheck(label: string, detail: string): CapabilityCheck {
  return { label, detail, state: 'fail' }
}

export function diagnoseImageProfile(profile: ApiProfile | null): ModelCapabilityDiagnostic {
  if (!profile) {
    return {
      level: 'error',
      title: '图像配置不可用',
      summary: '请选择一个图像模型 API 配置。',
      checks: [failCheck('配置选择', '尚未选择图像模型配置')],
    }
  }

  const validationError = validateApiProfile(profile)
  const checks: CapabilityCheck[] = validationError
    ? [failCheck('基础配置', validationError)]
    : [readyCheck('基础配置', '请求地址或开发代理、密钥和模型 ID 已配置')]

  if (profile.provider === 'openai' && profile.apiMode === 'responses') {
    checks.push(readyCheck('Agent 原生生图', `通过 Responses API 调用 ${profile.imageGenerationModel || profile.model}`))
    checks.push(infoCheck('普通生图', '支持 Responses 图像生成；实际能力仍取决于上游模型'))
  } else if (profile.provider === 'sb2api-async') {
    checks.push(readyCheck('异步任务', '支持提交、轮询和刷新后的任务恢复'))
    checks.push(infoCheck('Agent 接入', '可用于混合模式或提案模式，不作为原生 Agent 文本模型'))
  } else if (profile.provider === 'fal') {
    checks.push(readyCheck('队列任务', '支持 fal.ai 队列生成和恢复'))
    checks.push(infoCheck('Agent 接入', '可用于混合模式或提案模式，不作为原生 Agent 文本模型'))
  } else if (profile.provider === 'openai') {
    checks.push(readyCheck('图像生成与编辑', '使用 OpenAI 兼容 Images API'))
    checks.push(infoCheck('Agent 接入', '可用于混合模式或提案模式；原生模式需要 Responses API'))
  } else {
    checks.push(readyCheck('自定义图像请求', '已配置自定义 HTTP 图像服务商'))
    checks.push(infoCheck('能力边界', '编辑、异步轮询和结果解析能力由服务商模板决定'))
  }

  return {
    level: validationError ? 'error' : 'ready',
    title: validationError ? '图像配置需要修复' : '图像配置可用',
    summary: validationError
      ? `请完善「${profile.name || '未命名配置'}」：${validationError}`
      : `${profile.name} · ${profile.model}`,
    checks,
  }
}

export function diagnoseTextModel(model: TextModelConfig | null): ModelCapabilityDiagnostic {
  if (!model) {
    return {
      level: 'error',
      title: '文本模型不可用',
      summary: '尚未选择文本模型。',
      checks: [failCheck('模型选择', '请添加并选择一个文本模型')],
    }
  }

  const missing: string[] = []
  if (!model.modelId.trim()) missing.push('模型 ID')
  if (!model.apiKey.trim()) missing.push('API Key')
  if (!model.baseUrl.trim()) missing.push('Base URL')

  const checks: CapabilityCheck[] = missing.length
    ? [failCheck('基础配置', `缺少：${missing.join('、')}`)]
    : [readyCheck('基础配置', '协议、地址、密钥和模型 ID 已填写')]
  if (!model.name.trim()) checks.push(infoCheck('显示名称', '未填写时使用模型 ID 展示，不影响请求'))

  if (model.protocol === 'openai-responses') {
    checks.push(readyCheck('Agent 提案', '支持结构化文本分析和多模态输入'))
    checks.push(readyCheck('原生工具能力', '协议支持 Responses 工具调用；原生 Agent 仍需在 API 配置中选择 Responses 配置'))
  } else if (model.protocol === 'openai-chat-completions') {
    checks.push(readyCheck('Agent 提案', '兼容大多数 OpenAI Chat 中转'))
    checks.push(infoCheck('原生工具能力', '此注册表模型用于提案模式，不用于原生 Agent 工具调用'))
  } else if (model.protocol === 'anthropic-messages') {
    checks.push(readyCheck('Agent 提案', '支持 Anthropic Messages 文本与图片输入'))
    checks.push(infoCheck('原生工具能力', '在本应用中用于提案模式和文本任务'))
  } else {
    checks.push(readyCheck('Agent 提案', '支持 Gemini generateContent 文本与图片输入'))
    checks.push(infoCheck('原生工具能力', '在本应用中用于提案模式和文本任务'))
  }

  return {
    level: missing.length ? 'error' : 'ready',
    title: missing.length ? '文本模型需要修复' : '文本模型可用',
    summary: missing.length
      ? `${model.name || model.modelId || '未命名模型'}：${missing.join('、')}未填写`
      : `${model.name} · ${model.modelId}`,
    checks,
  }
}

export function diagnoseAgentConfiguration(
  settings: AppSettings,
  textModels: TextModelConfig[],
  textDefaults: TextDefaults,
): ModelCapabilityDiagnostic {
  const mode = settings.agentApiConfigMode
  if (mode === 'off') {
    const activeProfile = getAgentTextApiProfile(settings)
    const compatible = Boolean(activeProfile && activeProfile.provider === 'openai' && activeProfile.apiMode === 'responses')
    const validationError = activeProfile ? validateApiProfile(activeProfile) : '当前 API 配置不存在'
    if (!compatible || validationError) {
      return {
        level: 'error',
        title: '当前配置不能用于 Agent',
        summary: !compatible ? '关闭独立配置后，当前 API 必须是 OpenAI 兼容 Responses 配置。' : `当前配置不完整：${validationError}`,
        checks: [
          failCheck('当前 API 配置', !compatible ? 'Images API 不提供 Agent 对话能力' : validationError || '配置不可用'),
          infoCheck('推荐设置', '切换为提案模式可使用任意受支持的文本协议与图像配置'),
        ],
      }
    }
    return {
      level: 'warning',
      title: 'Agent 跟随当前配置',
      summary: `${activeProfile?.name} · ${activeProfile?.model} 的静态配置已通过。`,
      checks: [
        readyCheck('Responses 配置', '当前 API 可用于 Agent 对话'),
        infoCheck('图像工具', '上游是否开放 image_generation 工具需要实际请求确认'),
      ],
    }
  }

  if (mode === 'proposal') {
    const textModel = resolveTextModel(textModels, textDefaults, 'agent') ?? null
    const textDiagnostic = diagnoseTextModel(textModel)
    const imageDiagnostic = diagnoseImageProfile(getAgentImageApiProfile(settings))
    const failed = textDiagnostic.level === 'error' || imageDiagnostic.level === 'error'
    return {
      level: failed ? 'error' : 'ready',
      title: failed ? '提案模式需要配置' : '提案模式已就绪',
      summary: failed
        ? '请按下方提示补齐文本大脑或图像模型配置。'
        : `${textModel?.name || textModel?.modelId} 负责分析，${getAgentImageApiProfile(settings)?.name} 负责出图。`,
      checks: [
        ...(textDiagnostic.level === 'error'
          ? [failCheck('文本大脑', textDiagnostic.summary)]
          : [readyCheck('文本大脑', `${textModel?.name || textModel?.modelId} · ${textModel?.protocol}`)]),
        ...(imageDiagnostic.level === 'error'
          ? [failCheck('图像模型', imageDiagnostic.summary)]
          : [readyCheck('图像模型', imageDiagnostic.summary)]),
        infoCheck('执行流程', '先生成提案，确认后再调用图像 API，不会未经确认直接出图'),
      ],
    }
  }

  const textProfile = getAgentTextApiProfile(settings)
  const textError = textProfile ? validateApiProfile(textProfile) : '未选择 Responses API 文本配置'
  const textCompatible = Boolean(textProfile && textProfile.provider === 'openai' && textProfile.apiMode === 'responses')
  const checks: CapabilityCheck[] = []

  if (!textCompatible) {
    checks.push(failCheck('Responses 文本配置', '原生和混合模式需要 OpenAI 兼容 Responses API 配置'))
  } else if (textError) {
    checks.push(failCheck('Responses 文本配置', textError))
  } else {
    checks.push(readyCheck('Responses 文本配置', `${textProfile?.name} · ${textProfile?.model}`))
  }

  if (mode === 'native') {
    checks.push(infoCheck('图像工具', `模型将调用 image_generation；目标模型为 ${textProfile?.imageGenerationModel || textProfile?.model || '未设置'}`))
    const failed = !textCompatible || Boolean(textError)
    return {
      level: failed ? 'error' : 'warning',
      title: failed ? '原生模式需要配置' : '原生模式配置完整',
      summary: failed
        ? '请选择并完善 Responses API 配置。'
        : '静态配置已通过；上游是否开放 image_generation 工具需要实际请求确认。',
      checks,
    }
  }

  const imageDiagnostic = diagnoseImageProfile(getAgentImageApiProfile(settings))
  checks.push(imageDiagnostic.level === 'error'
    ? failCheck('图像模型', imageDiagnostic.summary)
    : readyCheck('图像模型', imageDiagnostic.summary))
  checks.push(infoCheck('执行流程', 'Responses 文本模型调用自定义工具，再由独立图像配置出图'))
  const failed = !textCompatible || Boolean(textError) || imageDiagnostic.level === 'error'
  return {
    level: failed ? 'error' : 'ready',
    title: failed ? '混合模式需要配置' : '混合模式已就绪',
    summary: failed ? '请补齐 Responses 文本配置或图像配置。' : '文本推理与图像生成配置均可用。',
    checks,
  }
}
