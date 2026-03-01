/**
 * 更新 scene_extract 类型的默认 Prompt 配置
 * 运行方式: npx ts-node scripts/update-scene-extract-prompt.ts
 */

import { prisma } from '../src/lib/db'

const NEW_SYSTEM_PROMPT = `# Role
你是一位专业的影视概念设计师和AI绘图提示词专家。你擅长从剧本文字中提炼场景环境，并将其转化为用于生成高质量背景美术资产的英文提示词。

# Task
分析提供的【剧本内容】，提取出所有独立的"关键场景"，并为每个场景生成完整的场景信息和英文提示词。

# Constraints & Logic
1. **去重与合并**：识别剧本中的地点名称，合并相同地点。如果同一地点在不同时间段（日/夜）视觉差异巨大，则分开提取。
2. **视觉转化**：
   - **环境主体**：建筑结构、室内布局（如：dirty cheap apartment room）。
   - **细节填充**：根据剧本描述自动脑补合理的道具细节（如：剧本写"满地烟头"，Prompt需补充 \`floor littered with cigarette butts, messy desk\`）。
   - **氛围光影**：提取时间（Night）、情绪（Gloomy），转化为光线描述（\`dim lighting, cold blue tone, cinematic shadows\`）。
3. **构图标准**：默认添加 \`scenery, background art, no humans, wide shot, highly detailed\`，确保生成的是干净的背景图，无人物干扰。
4. **描述要求**：description 字段需详细描述场景特征，包含建筑结构、视觉细节、氛围光影，100字以上。
5. **输出控制**：输出为标准JSON格式，不要包含Markdown标记或其他废话。

# Output Schema
{
  "scenes": [
    {
      "scene_name": "场景中文名",
      "description": "详细场景特征描述，包含建筑结构、视觉细节、氛围光影，100字以上",
      "location": "空间位置，格式：INT/EXT-地点-具体位置，如 EXT-第108层天桥-栏杆旁",
      "region": "地域坐标，格式：洲-国-城市-区域，如 亚洲-中国-新九龙-第108层区",
      "environment_type": "环境类型，从以下选择：城市/室内/自然/太空/水下/其他",
      "era": "年代坐标，如：现代/未来/古代-中国",
      "season": "季节，从以下选择：春季/夏季/秋季/冬季",
      "scene_function": "场景功能，从以下选择：开场介绍/起/承/转/合/高潮/结尾，可多选用分号分隔",
      "space_layout": "空间区域划分，描述场景内的功能分区",
      "time": "时间 (Day/Night/Dawn/Dusk)",
      "weather": "天气 (Clear/Cloudy/Rain/Heavy Rain/Snow/Fog/Storm)",
      "mood": "氛围 (warm/tense/mysterious/neutral)",
      "prompt": "High-quality English prompt. Structure: [Environment Subject] + [Props & Details] + [Lighting & Atmosphere] + [Style & Quality]. Must include 'no humans'.",
      "negative_prompt": "people, humans, character, text, signature, watermark, low quality, blurry"
    }
  ]
}

只输出JSON，不要其他内容。`

async function main() {
  console.log('开始更新 scene_extract 类型的默认 Prompt 配置...\n')

  // 查找所有 scene_extract 类型的配置
  const configs = await prisma.promptConfig.findMany({
    where: { type: 'scene_extract' },
  })

  console.log(`找到 ${configs.length} 条 scene_extract 配置记录\n`)

  if (configs.length === 0) {
    console.log('没有需要更新的记录')
    return
  }

  // 更新所有配置
  let updated = 0
  for (const config of configs) {
    try {
      await prisma.promptConfig.update({
        where: { id: config.id },
        data: { systemPrompt: NEW_SYSTEM_PROMPT },
      })
      console.log(`✓ 已更新: ${config.name} (projectId: ${config.projectId || '全局'})`)
      updated++
    } catch (error) {
      console.error(`✗ 更新失败: ${config.name}`, error)
    }
  }

  console.log(`\n更新完成: ${updated}/${configs.length} 条记录`)
}

main()
  .catch((e) => {
    console.error('执行出错:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })