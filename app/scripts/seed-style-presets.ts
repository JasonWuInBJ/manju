import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({ url: './dev.db' })
const prisma = new PrismaClient({ adapter })

const systemPresets = [
  // 主流商业漫剧风 (popular)
  {
    id: 'cel-shaded',
    name: '二次元赛璐璐',
    keywords: 'Anime style, cel shading, flat colors, clean lines, vibrant',
    category: 'popular',
    icon: '✨',
    description: '线条清晰，色彩明快，适合热血搞笑',
    isDefault: true,
    order: 1,
  },
  {
    id: 'ghibli',
    name: '吉卜力风格',
    keywords: 'Studio Ghibli style, Hayao Miyazaki style, hand-drawn, watercolor texture, lush nature, whimsical, serene, vibrant blues and greens',
    category: 'popular',
    icon: '🌿',
    description: '自然清新，色彩饱满，适合奇幻冒险治愈',
    isDefault: true,
    order: 2,
  },
  {
    id: 'shonen',
    name: '热血少年漫',
    keywords: 'Shonen manga style, dynamic composition, speed lines, impactful, exaggerated anatomy, energetic, bold outlines, action scene',
    category: 'popular',
    icon: '⚡',
    description: '动作张力强，线条有力，适合冒险竞技',
    isDefault: true,
    order: 3,
  },
  {
    id: 'kawaii',
    name: '萌系二次元',
    keywords: 'Kawaii, Moe style, big eyes, pastel colors, soft lighting, blush, cute, innocent',
    category: 'popular',
    icon: '💖',
    description: '人物可爱，色调柔和，适合恋爱日常',
    isDefault: true,
    order: 4,
  },
  {
    id: 'korean-webtoon',
    name: '韩漫精致风',
    keywords: 'Korean webtoon style, manhwa style, detailed illustration, soft lighting',
    category: 'popular',
    icon: '🇰🇷',
    description: '人物俊美，光影柔和，适合都市言情',
    isDefault: true,
    order: 5,
  },
  {
    id: 'shinkai',
    name: '新海诚风',
    keywords: 'Makoto Shinkai style, anime art, vibrant colors, lens flare, detailed clouds',
    category: 'popular',
    icon: '🌈',
    description: '背景精美，色彩饱和，适合青春奇幻',
    isDefault: true,
    order: 6,
  },
  {
    id: 'digital-painting',
    name: '厚涂概念风',
    keywords: 'Digital painting, semi-realistic, thick impasto, artstation trending, cinematic lighting',
    category: 'popular',
    icon: '🎨',
    description: '笔触感强，电影海报质感，适合悬疑动作',
    isDefault: true,
    order: 7,
  },

  // 特色艺术风格 (artistic)
  {
    id: 'chinese-ink',
    name: '国潮水墨风',
    keywords: 'Chinese ink wash painting, traditional chinese art, watercolor style, elegant, ink splashes',
    category: 'artistic',
    icon: '🏯',
    description: '意境深远，适合仙侠古风历史',
    isDefault: true,
    order: 1,
  },
  {
    id: 'cyberpunk',
    name: '赛博朋克风',
    keywords: 'Cyberpunk style, neon lights, futuristic, sci-fi, blade runner aesthetic',
    category: 'artistic',
    icon: '🌃',
    description: '霓虹光影，机械元素，适合科幻动作',
    isDefault: true,
    order: 2,
  },
  {
    id: 'post-apocalyptic',
    name: '末世废土',
    keywords: 'Post-apocalyptic, wasteland, rust, dust, ruins, mechanical details, desaturated colors, cinematic lighting, gritty',
    category: 'artistic',
    icon: '🏚️',
    description: '荒凉破败，机械质感，适合生存末世',
    isDefault: true,
    order: 3,
  },
  {
    id: 'retro-comic',
    name: '复古漫画风',
    keywords: 'Retro comic book style, vintage colors, halftone pattern, ben-day dots',
    category: 'artistic',
    icon: '📰',
    description: '美漫/老港漫风格，适合侦探黑色幽默',
    isDefault: true,
    order: 4,
  },
  {
    id: 'dark-noir',
    name: '悬疑暗黑',
    keywords: 'Dark fantasy, Noir style, Horror anime, low key lighting, shadows, mysterious, eerie, cold tones, dramatic contrast',
    category: 'artistic',
    icon: '🕯️',
    description: '光影神秘，氛围压抑，适合推理恐怖',
    isDefault: true,
    order: 5,
  },

  // 3D与渲染风格 (3d)
  {
    id: 'unreal-engine',
    name: '虚幻引擎渲染',
    keywords: 'Unreal Engine 5 render, 3D render, octane render, ray tracing, 8k',
    category: '3d',
    icon: '🎮',
    description: '超写实光影材质，适合高端制作',
    isDefault: true,
    order: 1,
  },
  {
    id: 'western-animation',
    name: '欧美动漫',
    keywords: 'Disney style, Pixar style, Western animation, 3D render, expressive face, exaggerated expressions, glossy, subsurface scattering',
    category: '3d',
    icon: '🎬',
    description: '表情生动，材质细腻，适合全年龄合家欢',
    isDefault: true,
    order: 2,
  },
  {
    id: 'blind-box',
    name: '盲盒/粘土风',
    keywords: 'Blind box style, chibi, clay render, 3D cute, soft focus',
    category: '3d',
    icon: '🧸',
    description: 'Q版萌系，适合轻松搞笑儿童向',
    isDefault: true,
    order: 3,
  },
  {
    id: '2.5d',
    name: '2.5D 风格',
    keywords: '2.5D style, isometric view, 3D background with anime character',
    category: '3d',
    icon: '🔷',
    description: '特殊视角，常用于场景展示',
    isDefault: true,
    order: 4,
  },
]

async function main() {
  console.log('开始插入系统预设...')

  for (const preset of systemPresets) {
    await prisma.stylePreset.create({
      data: preset,
    })
    console.log(`✓ 已插入: ${preset.name}`)
  }

  console.log('所有系统预设插入完成！')
}

main()
  .catch((e) => {
    console.error('插入失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })