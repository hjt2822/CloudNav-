
// 服务端图标代理：抓取目标站点真实图标并回源返回（含浏览器缓存头）
// 解决国内访问 t2.gstatic.com / favicon.im 等第三方服务不稳定的问题：
// 部署到 Cloudflare Pages 后，客户端直接请求本站 /api/favicon，无需依赖第三方。

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const fetchWithTimeout = async (url: string, ms: number): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        'Accept': 'image/*,*/*;q=0.8',
        'Referer': new URL(url).origin + '/',
      },
    });
  } finally {
    clearTimeout(timer);
  }
};

const attrHref = (tag: string): string => {
  const m = tag.match(/href\s*=\s*["']([^"']+)["']/i);
  return m ? m[1] : '';
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

  // 候选源：页面声明图标 -> /favicon.ico -> 国内友好服务 -> Google 服务
  const candidates: string[] = [];

  try {
    const page = await fetchWithTimeout(target.toString(), 8000);
    if (page.ok) {
      const html = (await page.text()).slice(0, 150000);
      const iconTag =
        html.match(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*>/i) ||
        html.match(/<link[^>]+rel=["'][^"']*(?:shortcut\s+)?icon["'][^>]*>/i);
      if (iconTag) {
        const href = attrHref(iconTag[0]);
        if (href) {
          try { candidates.push(new URL(href, target).href); } catch { /* ignore */ }
        }
      }
    }
  } catch { /* 页面抓取失败继续走候选源 */ }

  candidates.push(new URL('/favicon.ico', target).href);
  candidates.push(`https://api.iowen.cn/favicon/${target.hostname}.png`);
  candidates.push(`https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(target.origin)}&size=128`);

  for (const src of candidates) {
    try {
      const resp = await fetchWithTimeout(src, 6000);
      if (!resp.ok) continue;
      const type = resp.headers.get('content-type') || '';
      if (type && !type.includes('image') && !type.includes('octet-stream')) continue;
      const buf = await resp.arrayBuffer();
      // 过滤空文件或明显的错误占位
      if (buf.byteLength < 100 || buf.byteLength > 2 * 1024 * 1024) continue;
      return new Response(buf, {
        headers: {
          'Content-Type': type || 'image/x-icon',
          'Cache-Control': 'public, max-age=86400',
          ...corsHeaders,
        },
      });
    } catch { /* 尝试下一个候选源 */ }
  }

  return new Response(JSON.stringify({ error: 'Icon not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
};
