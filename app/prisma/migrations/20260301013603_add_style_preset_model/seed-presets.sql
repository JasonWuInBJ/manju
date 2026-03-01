-- 插入系统预设风格

-- 主流商业漫剧风 (popular)
INSERT INTO StylePreset (id, name, keywords, category, icon, description, isDefault, `order`, projectId, createdAt, updatedAt) VALUES
('cel-shaded', '二次元赛璐璐', 'Anime style, cel shading, flat colors, clean lines, vibrant', 'popular', '✨', '线条清晰，色彩明快，适合热血搞笑', 1, 1, NULL, datetime('now'), datetime('now')),
('ghibli', '吉卜力风格', 'Studio Ghibli style, Hayao Miyazaki style, hand-drawn, watercolor texture, lush nature, whimsical, serene, vibrant blues and greens', 'popular', '🌿', '自然清新，色彩饱满，适合奇幻冒险治愈', 1, 2, NULL, datetime('now'), datetime('now')),
('shonen', '热血少年漫', 'Shonen manga style, dynamic composition, speed lines, impactful, exaggerated anatomy, energetic, bold outlines, action scene', 'popular', '⚡', '动作张力强，线条有力，适合冒险竞技', 1, 3, NULL, datetime('now'), datetime('now')),
('kawaii', '萌系二次元', 'Kawaii, Moe style, big eyes, pastel colors, soft lighting, blush, cute, innocent', 'popular', '💖', '人物可爱，色调柔和，适合恋爱日常', 1, 4, NULL, datetime('now'), datetime('now')),
('korean-webtoon', '韩漫精致风', 'Korean webtoon style, manhwa style, detailed illustration, soft lighting', 'popular', '🇰🇷', '人物俊美，光影柔和，适合都市言情', 1, 5, NULL, datetime('now'), datetime('now')),
('shinkai', '新海诚风', 'Makoto Shinkai style, anime art, vibrant colors, lens flare, detailed clouds', 'popular', '🌈', '背景精美，色彩饱和，适合青春奇幻', 1, 6, NULL, datetime('now'), datetime('now')),
('digital-painting', '厚涂概念风', 'Digital painting, semi-realistic, thick impasto, artstation trending, cinematic lighting', 'popular', '🎨', '笔触感强，电影海报质感，适合悬疑动作', 1, 7, NULL, datetime('now'), datetime('now'));

-- 特色艺术风格 (artistic)
INSERT INTO StylePreset (id, name, keywords, category, icon, description, isDefault, `order`, projectId, createdAt, updatedAt) VALUES
('chinese-ink', '国潮水墨风', 'Chinese ink wash painting, traditional chinese art, watercolor style, elegant, ink splashes', 'artistic', '🏯', '意境深远，适合仙侠古风历史', 1, 1, NULL, datetime('now'), datetime('now')),
('cyberpunk', '赛博朋克风', 'Cyberpunk style, neon lights, futuristic, sci-fi, blade runner aesthetic', 'artistic', '🌃', '霓虹光影，机械元素，适合科幻动作', 1, 2, NULL, datetime('now'), datetime('now')),
('post-apocalyptic', '末世废土', 'Post-apocalyptic, wasteland, rust, dust, ruins, mechanical details, desaturated colors, cinematic lighting, gritty', 'artistic', '🏚️', '荒凉破败，机械质感，适合生存末世', 1, 3, NULL, datetime('now'), datetime('now')),
('retro-comic', '复古漫画风', 'Retro comic book style, vintage colors, halftone pattern, ben-day dots', 'artistic', '📰', '美漫/老港漫风格，适合侦探黑色幽默', 1, 4, NULL, datetime('now'), datetime('now')),
('dark-noir', '悬疑暗黑', 'Dark fantasy, Noir style, Horror anime, low key lighting, shadows, mysterious, eerie, cold tones, dramatic contrast', 'artistic', '🕯️', '光影神秘，氛围压抑，适合推理恐怖', 1, 5, NULL, datetime('now'), datetime('now'));

-- 3D与渲染风格 (3d)
INSERT INTO StylePreset (id, name, keywords, category, icon, description, isDefault, `order`, projectId, createdAt, updatedAt) VALUES
('unreal-engine', '虚幻引擎渲染', 'Unreal Engine 5 render, 3D render, octane render, ray tracing, 8k', '3d', '🎮', '超写实光影材质，适合高端制作', 1, 1, NULL, datetime('now'), datetime('now')),
('western-animation', '欧美动漫', 'Disney style, Pixar style, Western animation, 3D render, expressive face, exaggerated expressions, glossy, subsurface scattering', '3d', '🎬', '表情生动，材质细腻，适合全年龄合家欢', 1, 2, NULL, datetime('now'), datetime('now')),
('blind-box', '盲盒/粘土风', 'Blind box style, chibi, clay render, 3D cute, soft focus', '3d', '🧸', 'Q版萌系，适合轻松搞笑儿童向', 1, 3, NULL, datetime('now'), datetime('now')),
('2.5d', '2.5D 风格', '2.5D style, isometric view, 3D background with anime character', '3d', '🔷', '特殊视角，常用于场景展示', 1, 4, NULL, datetime('now'), datetime('now'));