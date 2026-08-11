import type { ChatMessage } from '../types'

const MAX = 60

function keyOf(agentId: string) {
  return `eisland.chat.${agentId}`
}

/** 读取某智能体的聊天记录（仅保留 user / assistant 消息） */
export function loadHistory(agentId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(keyOf(agentId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatMessage[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((m) => m.role === 'user' || m.role === 'assistant')
  } catch {
    return []
  }
}

/** 保存某智能体的聊天记录（截断到最近 MAX 条；空则清除） */
export function saveHistory(agentId: string, messages: ChatMessage[]) {
  const keep = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-MAX)
  if (keep.length === 0) {
    localStorage.removeItem(keyOf(agentId))
  } else {
    localStorage.setItem(keyOf(agentId), JSON.stringify(keep))
  }
}
