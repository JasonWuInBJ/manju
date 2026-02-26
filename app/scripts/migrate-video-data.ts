/**
 * 数据迁移脚本：将现有 Video 数据迁移到新结构
 *
 * 运行方式：npx ts-node scripts/migrate-video-data.ts
 */

import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  console.log('开始迁移...')

  // 获取所有项目
  const projects = await prisma.project.findMany()
  console.log(`找到 ${projects.length} 个项目`)

  for (const project of projects) {
    console.log(`\n处理项目: ${project.title}`)

    // 获取该项目的所有视频
    const videos = await prisma.video.findMany({
      where: { projectId: project.id },
      include: { script: true }
    })

    if (videos.length === 0) {
      console.log('  无视频数据，跳过')
      continue
    }

    // 创建默认 Episode
    const episode = await prisma.episode.create({
      data: {
        projectId: project.id,
        name: '默认合集',
        description: '从旧数据迁移的默认合集',
      }
    })
    console.log(`  创建 Episode: ${episode.name}`)

    // 迁移每个视频
    for (const video of videos) {
      console.log(`  迁移视频: ${video.name || video.id}`)

      // 更新视频的 episodeId
      await prisma.video.update({
        where: { id: video.id },
        data: { episodeId: episode.id }
      })

      // 迁移合成图资产
      if (video.compositeImageUrl) {
        await prisma.videoAsset.create({
          data: {
            videoId: video.id,
            type: 'composite_image',
            url: video.compositeImageUrl,
            taskId: video.compositeImageTaskId,
            aspectRatio: '16:9',
            version: 1,
          }
        })
        console.log('    ✓ 合成图资产已迁移')
      }

      // 迁移视频资产
      if (video.videoUrl) {
        await prisma.videoAsset.create({
          data: {
            videoId: video.id,
            type: 'video',
            url: video.videoUrl,
            taskId: video.videoTaskId,
            prompt: video.videoPrompt,
            version: 1,
          }
        })
        console.log('    ✓ 视频资产已迁移')
      }
    }
  }

  console.log('\n迁移完成！')
}

main()
  .catch((e) => {
    console.error('迁移失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
