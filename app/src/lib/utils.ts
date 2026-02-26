import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 处理思考模型的输出，提取纯文本或 JSON 内容
 * 移除各种 AI 思考过程的标签和伪代码
 */
export function extractTextFromThinkingModel(text: string): string {
  let cleanedText = text

  // 移除 <thinking>...</thinking> 标签及其内容
  cleanedText = cleanedText.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')

  // 移除 <function_calls>...</function_calls> 标签及其内容
  cleanedText = cleanedText.replace(/<function_calls>[\s\S]*?<\/function_calls>/gi, '')

  // 移除 <invoke>...</invoke> 标签及其内容
  cleanedText = cleanedText.replace(/<invoke>[\s\S]*?<\/invoke>/gi, '')

  // 移除 markdown 代码块标记（```json 和 ```）
  cleanedText = cleanedText.replace(/```json\s*/gi, '').replace(/```\s*/g, '')

  // 移除常见的 AI 思考前缀
  cleanedText = cleanedText.replace(/^(让我|我会|我来|我会先|首先)[，、。].*$/gm, '')

  // 移除空行过多的情况（保留最多两个连续空行）
  cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n')

  return cleanedText.trim()
}

/**
 * 从思考模型的输出中提取并解析 JSON
 * 处理 markdown 代码块包裹的情况
 */
export function extractJsonFromThinkingModel(text: string): any {
  // 先移除各种标签
  let cleanedText = extractTextFromThinkingModel(text)

  // 再次确保移除 markdown 代码块标记
  cleanedText = cleanedText.replace(/```json\s*/gi, '').replace(/```\s*/g, '')

  return JSON.parse(cleanedText.trim())
}
