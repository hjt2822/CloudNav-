// 根据分类名称自动匹配图标（当分类未自定义图标或使用通用 Folder 图标时生效）
// 关键词命中即返回对应 lucide 图标名，提升目录层次感

const RULES: Array<[RegExp, string]> = [
  [/ai|人工智能|大模型|智能/i, 'Bot'],
  [/api|接口|中转|公益/i, 'Plug'],
  [/mcp|协议/i, 'Cable'],
  [/搜索/i, 'Search'],
  [/翻译|语言/i, 'Languages'],
  [/开发|代码|编程|程序/i, 'Code'],
  [/前端|框架|ui|界面|布局/i, 'Layout'],
  [/react/i, 'Atom'],
  [/vue/i, 'Leaf'],
  [/运维|服务器|部署|主机/i, 'Server'],
  [/数据库|存储|网盘|备份/i, 'Database'],
  [/云/i, 'Cloud'],
  [/终端|命令行|shell/i, 'Terminal'],
  [/安全|加密/i, 'Shield'],
  [/设计|绘画|画图|图像|图片/i, 'Palette'],
  [/配色|颜色/i, 'Droplet'],
  [/图标/i, 'Smile'],
  [/动效|动画/i, 'Film'],
  [/视频|影视|电影|录像/i, 'Video'],
  [/音乐|音频/i, 'Music'],
  [/游戏|娱乐/i, 'Gamepad2'],
  [/阅读|资讯|新闻|博客|文章/i, 'Newspaper'],
  [/学习|教程|文档|知识|书/i, 'BookOpen'],
  [/社交|聊天|社区|论坛/i, 'MessageCircle'],
  [/邮箱|邮件/i, 'Mail'],
  [/购物|商城/i, 'ShoppingBag'],
  [/投资|股票|金融|行情|基金/i, 'TrendingUp'],
  [/办公|工作|效率|协作/i, 'Briefcase'],
  [/工具/i, 'Wrench'],
  [/导航|目录/i, 'Compass'],
  [/下载/i, 'Download'],
  [/域名|网站/i, 'Globe'],
  [/订阅|付费|会员/i, 'CreditCard'],
  [/模型|硬件|芯片/i, 'Cpu'],
  [/创意|灵感|魔法/i, 'Sparkles'],
  [/经验|技巧|笔记/i, 'Lightbulb'],
];

const GENERIC_ICONS = new Set(['', 'Folder', undefined]);

export const autoIconForName = (name: string): string => {
  for (const [pattern, icon] of RULES) {
    if (pattern.test(name)) return icon;
  }
  return 'Folder';
};

// 展示用图标：通用图标或缺失时按名称推导，用户自定义图标优先
export const displayIconOf = (name: string, icon?: string): string => {
  if (GENERIC_ICONS.has(icon as string)) {
    return autoIconForName(name);
  }
  return icon as string;
};
