import type { AgentConfig } from '../types'

const STORAGE_KEY = 'eisland.agents'
const ACTIVE_KEY = 'eisland.activeAgent'

/** 旧版预设 id（通用助手/代码助手/翻译官/Ollama），用于数据迁移 */
const OLD_PRESET_IDS = ['general', 'coder', 'translator', 'local']

/** 预设智能体模板（用户需在设置中填写自己的 API Key 才会启用） */
export const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: 'chat',
    name: 'Chat',
    description: '通用对话助手',
    systemPrompt: '你是一个乐于助人的 AI 助手，请用简洁、友好、自然的简体中文回答。',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
    temperature: 0.7
  },
  {
    id: 'claw',
    name: 'Claw',
    description: '编码与工具',
    systemPrompt:
      '你是 Claw，一名资深软件工程师助手。擅长编写代码、调试、代码审查与技术问题解答，回答时给出可直接运行的代码示例并简要解释关键点。',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
    temperature: 0.3
  }
]

export function loadAgents(): AgentConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AgentConfig[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        // 迁移：若含旧版预设（通用助手/代码助手/翻译官/Ollama），替换为新的 Chat + Claw，保留用户自定义
        const hasOld = parsed.some((a) => OLD_PRESET_IDS.includes(a.id))
        if (hasOld) {
          const custom = parsed.filter((a) => !OLD_PRESET_IDS.includes(a.id))
          const merged = [...DEFAULT_AGENTS.map((a) => ({ ...a })), ...custom]
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
          return merged
        }
        return parsed
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_AGENTS.map((a) => ({ ...a }))
}

export function saveAgents(agents: AgentConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents))
}

export function getActiveAgentId(): string {
  const id = localStorage.getItem(ACTIVE_KEY)
  return id ?? DEFAULT_AGENTS[0].id
}

export function setActiveAgentId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id)
}

export function newAgentId(): string {
  return `agent-${Date.now().toString(36)}`
}

/** 常见 OpenAI 兼容服务商预设 */
export interface ProviderInfo {
  key: string
  name: string
  defaultUrl: string
  model: string
  systemPrompt: string
}

export const PROVIDERS: ProviderInfo[] = [
  {
    key: 'deepseek',
    name: 'DeepSeek',
    defaultUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    systemPrompt: '你是一个乐于助人的 AI 助手，请用简洁、自然的简体中文回答。'
  },
  {
    key: 'openai',
    name: 'OpenAI',
    defaultUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    systemPrompt: 'You are a helpful assistant. Reply in Chinese unless asked otherwise.'
  },
  {
    key: 'ollama',
    name: 'Ollama 本地',
    defaultUrl: 'http://localhost:11434/v1',
    model: 'llama3',
    systemPrompt: '你是一个乐于助人的 AI 助手，请用简洁、自然的简体中文回答。'
  },
  {
    key: 'moonshot',
    name: 'Moonshot (Kimi)',
    defaultUrl: 'https://api.moonshot.cn/v1',
    model: 'kimi-latest',
    systemPrompt: '你是 Kimi，由 Moonshot AI 提供，请用简洁、友好的中文回答。'
  },
  {
    key: 'zhipu',
    name: '智谱 GLM',
    defaultUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-plus',
    systemPrompt: '你是智谱清言 AI，请用简洁、友好的中文回答。'
  },
  {
    key: 'siliconflow',
    name: '硅基流动',
    defaultUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
    systemPrompt: '你是一个乐于助人的 AI 助手，请用简洁、自然的简体中文回答。'
  },
  {
    key: 'dashscope',
    name: '通义千问',
    defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    systemPrompt: '你是通义千问，请用简洁、自然的中文回答。'
  },
  {
    key: 'openrouter',
    name: 'OpenRouter',
    defaultUrl: 'https://openrouter.ai/api/v1',
    model: 'deepseek/deepseek-chat',
    systemPrompt: 'You are a helpful assistant. Reply in Chinese unless asked otherwise.'
  },
  {
    key: 'xiaomi',
    name: '小米 MiMo',
    defaultUrl: 'https://api.xiaomimimo.com/v1',
    model: 'MiMo-7B-RL',
    systemPrompt: '你是小米 MiMo AI，请用简洁、自然的中文回答。'
  },
  {
    key: 'volcengine',
    name: '豆包 / 火山引擎',
    defaultUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-pro-32k',
    systemPrompt: '你是豆包，由字节跳动提供，请用简洁、自然的中文回答。'
  },
  {
    key: 'groq',
    name: 'Groq',
    defaultUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    systemPrompt: 'You are a helpful assistant. Reply in Chinese unless asked otherwise.'
  },
  {
    key: 'custom',
    name: '自定义',
    defaultUrl: '',
    model: '',
    systemPrompt: ''
  }
]

/** 根据 API 端点识别服务商类型；空/未识别均视为自定义 */
export function detectProvider(url: string): ProviderInfo | null {
  const u = (url || '').toLowerCase().trim()
  const find = (k: string) => PROVIDERS.find((p) => p.key === k) ?? null
  if (!u) return find('custom')
  if (u.includes('xiaomimimo') || u.includes('mimo')) return find('xiaomi')
  if (u.includes('volces') || u.includes('ark') || u.includes('doubao')) return find('volcengine')
  if (u.includes('groq')) return find('groq')
  if (u.includes('11434') || u.includes('ollama')) return find('ollama')
  if (u.includes('deepseek')) return find('deepseek')
  if (u.includes('moonshot') || u.includes('kimi')) return find('moonshot')
  if (u.includes('zhipu') || u.includes('bigmodel')) return find('zhipu')
  if (u.includes('siliconflow')) return find('siliconflow')
  if (u.includes('dashscope') || u.includes('aliyun')) return find('dashscope')
  if (u.includes('openrouter')) return find('openrouter')
  if (u.includes('openai')) return find('openai')
  // 未匹配任何已知服务商 → 视为自定义（自由填写端点/模型）
  return find('custom')
}
