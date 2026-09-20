
export interface LinkItem {
  id: string;
  title: string;
  url: string;
  icon?: string;
  description?: string;
  categoryId: string;
  createdAt: number;
  pinned?: boolean; // New field for pinning
}

export interface Category {
  id: string;
  name: string;
  icon: string; // Lucide icon name or emoji
  password?: string; // Optional password for category protection
  parentId?: string; // Parent category id for nested directories
}

export const getRootCategories = (categories: Category[]): Category[] =>
  categories.filter(c => !c.parentId);

export const getChildCategories = (categories: Category[], parentId: string): Category[] =>
  categories.filter(c => c.parentId === parentId);

export const getCategoryLabel = (categories: Category[], cat: Category): string => {
  if (!cat.parentId) return cat.name;
  const parent = categories.find(c => c.id === cat.parentId);
  return parent ? `${parent.name} / ${cat.name}` : cat.name;
};

export const flattenCategoryTree = (categories: Category[]): Category[] => {
  const result: Category[] = [];
  const placed = new Set<string>();
  categories.filter(c => !c.parentId).forEach(root => {
    result.push(root);
    placed.add(root.id);
    categories.filter(c => c.parentId === root.id).forEach(child => {
      result.push(child);
      placed.add(child.id);
    });
  });
  categories.forEach(c => {
    if (!placed.has(c.id)) result.push(c);
  });
  return result;
};

export interface SiteSettings {
  title: string;
  navTitle: string;
  favicon: string;
  cardStyle: 'detailed' | 'simple';
}

export interface AppState {
  links: LinkItem[];
  categories: Category[];
  darkMode: boolean;
  settings?: SiteSettings;
}

export interface WebDavConfig {
  url: string;
  username: string;
  password: string;
  enabled: boolean;
}

export type AIProvider = 'gemini' | 'openai';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'common', name: '常用推荐', icon: 'Star' },
  { id: 'media', name: '媒体资讯', icon: 'Newspaper' },
  { id: 'ai', name: 'AI工具包', icon: 'Bot' },
  { id: 'ai-assistant', name: 'AI助手', icon: 'MessageSquare', parentId: 'ai' },
  { id: 'ai-productivity', name: '生产力工具', icon: 'Briefcase', parentId: 'ai' },
  { id: 'ai-mcp', name: 'MCP Server', icon: 'Server', parentId: 'ai' },
  { id: 'ai-media', name: '多媒体', icon: 'Clapperboard', parentId: 'ai' },
  { id: 'ai-codegen', name: 'AI 代码生成助手', icon: 'Sparkles', parentId: 'ai' },
  { id: 'ai-prompt', name: '提示词助手', icon: 'Wand2', parentId: 'ai' },
  { id: 'dev', name: '开发者工具包', icon: 'Code' },
  { id: 'dev-icon', name: 'ICON', icon: 'Smile', parentId: 'dev' },
  { id: 'dev-ui', name: 'UI框架', icon: 'Layout', parentId: 'dev' },
  { id: 'dev-hosting', name: '托管平台', icon: 'Cloud', parentId: 'dev' },
  { id: 'dev-draw', name: '画图工具', icon: 'PenTool', parentId: 'dev' },
  { id: 'dev-aicoding', name: 'AI编程工具', icon: 'Terminal', parentId: 'dev' },
  { id: 'dev-domain', name: '域名注册', icon: 'Globe', parentId: 'dev' },
  { id: 'dev-subscription', name: '付费订阅托管平台', icon: 'CreditCard', parentId: 'dev' },
  { id: 'dev-video', name: '视频制作', icon: 'Video', parentId: 'dev' },
  { id: 'dev-animation', name: '动画工具', icon: 'Film', parentId: 'dev' },
  { id: 'dev-sdk', name: '开源组件&SDK', icon: 'Package', parentId: 'dev' },
  { id: 'dev-knowledge', name: '知识库', icon: 'BookOpen', parentId: 'dev' },
  { id: 'dev-ops', name: '运维工具', icon: 'Server', parentId: 'dev' },
  { id: 'dev-tips', name: '经验技巧', icon: 'Lightbulb', parentId: 'dev' },
  { id: 'dev-infra', name: '基础设施平台', icon: 'Database', parentId: 'dev' },
  { id: 'invest', name: '投资者工具包', icon: 'TrendingUp' },
  { id: 'invest-data', name: '数据与分析', icon: 'BarChart3', parentId: 'invest' },
  { id: 'invest-premium', name: '溢价观测工具', icon: 'Eye', parentId: 'invest' },
  { id: 'selfmedia', name: '自媒体工具包', icon: 'Megaphone' },
  { id: 'selfmedia-cn', name: '国内平台', icon: 'Flag', parentId: 'selfmedia' },
  { id: 'selfmedia-global', name: '国外平台', icon: 'Globe', parentId: 'selfmedia' },
  { id: 'selfmedia-wechat', name: '公众号排版', icon: 'FileText', parentId: 'selfmedia' },
  { id: 'selfmedia-record', name: '录屏工具', icon: 'Monitor', parentId: 'selfmedia' },
  { id: 'selfmedia-aidetect', name: 'AI 检测工具', icon: 'ScanSearch', parentId: 'selfmedia' },
  { id: 'selfmedia-pay', name: '付费订阅平台', icon: 'CreditCard', parentId: 'selfmedia' },
  { id: 'tools', name: '常用工具', icon: 'Wrench' },
  { id: 'tools-online', name: '在线工具', icon: 'Globe', parentId: 'tools' },
  { id: 'tools-graphic', name: '图形创意', icon: 'Palette', parentId: 'tools' },
  { id: 'tools-ui', name: '界面设计', icon: 'Layout', parentId: 'tools' },
  { id: 'tools-motion', name: '交互动效', icon: 'Sparkles', parentId: 'tools' },
  { id: 'tools-color', name: '在线配色', icon: 'Droplet', parentId: 'tools' },
  { id: 'assets', name: '素材资源', icon: 'Image' },
  { id: 'assets-icon', name: '图标素材', icon: 'Smile', parentId: 'assets' },
  { id: 'assets-logo', name: 'LOGO设计', icon: 'Award', parentId: 'assets' },
  { id: 'assets-graphic', name: '平面素材', icon: 'Layers', parentId: 'assets' },
  { id: 'opensource', name: '开源项目', icon: 'Github' },
  { id: 'docs', name: '文档工具', icon: 'FileText' },
];

export const INITIAL_LINKS: LinkItem[] = [
  { id: '1', title: 'GitHub', url: 'https://github.com', categoryId: 'dev', createdAt: Date.now(), description: '代码托管平台', pinned: true },
  { id: '2', title: 'React', url: 'https://react.dev', categoryId: 'dev-ui', createdAt: Date.now(), description: '构建Web用户界面的库' },
  { id: '3', title: 'Tailwind CSS', url: 'https://tailwindcss.com', categoryId: 'dev-ui', createdAt: Date.now(), description: '原子化CSS框架' },
  { id: '4', title: 'ChatGPT', url: 'https://chat.openai.com', categoryId: 'ai-assistant', createdAt: Date.now(), description: 'OpenAI聊天机器人', pinned: true },
  { id: '5', title: 'Gemini', url: 'https://gemini.google.com', categoryId: 'ai-assistant', createdAt: Date.now(), description: 'Google DeepMind AI' },
];

export interface SearchEngine {
  id: string;
  name: string;
  url: string; // e.g., https://www.google.com/search?q=
  icon: string; // url or key
}

export const DEFAULT_SEARCH_ENGINES: SearchEngine[] = [
    { id: 'local', name: '站内', url: '', icon: 'Search' },
    { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=', icon: 'https://www.google.com/favicon.ico' },
    { id: 'bing', name: '必应', url: 'https://www.bing.com/search?q=', icon: 'https://www.bing.com/favicon.ico' },
    { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd=', icon: 'https://www.baidu.com/favicon.ico' },
    { id: 'github', name: 'GitHub', url: 'https://github.com/search?q=', icon: 'https://github.com/favicon.ico' },
    { id: 'bilibili', name: 'B站', url: 'https://search.bilibili.com/all?keyword=', icon: 'https://www.bilibili.com/favicon.ico' },
];
