
// 智能获取网站信息：标题、描述、图标（参考 NavSphere "输入 URL 自动获取网站信息"）
// 服务端抓取页面绕过浏览器 CORS。本地 vite dev 无 functions，前端会静默降级。

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; }
    })
    .replace(/&#(\d+);/g, (_, d) => {
      try { return String.fromCodePoint(parseInt(d, 10)); } catch { return ''; }
    });

const stripTags = (s: string): string => s.replace(/<[^>]*>/g, ' ');

const cleanText = (s: string): string =>
  decodeEntities(stripTags(s)).replace(/\s+/g, ' ').trim();

const metaContent = (head: string, key: string): string => {
  const tags = head.match(/<meta[^>]*>/gi) || [];
  for (const tag of tags) {
    const nameM = tag.match(/(?:name|property|itemprop)\s*=\s*["']([^"']+)["']/i);
    if (!nameM || nameM[1].toLowerCase() !== key) continue;
    const contentM = tag.match(/content\s*=\s*["']([\s\S]*?)["']/i);
    if (contentM) return cleanText(contentM[1]);
  }
  return '';
};

export const onRequestGet = async (context: { request: Request; env: any }) => {
  const raw = new URL(context.request.url).searchParams.get('url');
  if (!raw) {
    return new Response(JSON.stringify({ error: 'Missing url' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let target: URL;
  try {
    target = new URL(raw.startsWith('http') ? raw : 'https://' + raw);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid url' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  try {
    const resp = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });
    clearTimeout(timer);

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `Site returned ${resp.status}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const html = await resp.text();
    const head = html.slice(0, 150000);

    const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? cleanText(titleMatch[1]) : '';

    let description =
      metaContent(head, 'description') ||
      metaContent(head, 'og:description') ||
      '';

    // 中文站点常用 keywords 兜底
    if (!description) {
      const kw = metaContent(head, 'keywords');
      if (kw) description = kw.slice(0, 160);
    }

    // 仍无描述时，取正文可见文本兜底
    if (!description) {
      const bodyStart = html.search(/<body[^>]*>/i);
      const body = html.slice(bodyStart > -1 ? bodyStart : 150000, (bodyStart > -1 ? bodyStart : 150000) + 150000);
      const visible = cleanText(
        body
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      );
      description = visible.slice(0, 160);
    }

    // 页面内声明的 icon（apple-touch-icon 优先，其次 icon）
    let pageIcon = '';
    const iconTag =
      head.match(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*>/i) ||
      head.match(/<link[^>]+rel=["'][^"']*(?:shortcut\s+)?icon["'][^>]*>/i);
    if (iconTag) {
      const hrefMatch = iconTag[0].match(/href\s*=\s*["']([^"']+)["']/i);
      if (hrefMatch) {
        try {
          pageIcon = new URL(hrefMatch[1], target).href;
        } catch { /* ignore */ }
      }
    }

    const meta = {
      title,
      description,
      icon: pageIcon || undefined,
      url: target.href,
    };

    return new Response(JSON.stringify(meta), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Fetch failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};
