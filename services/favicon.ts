// Favicon acquisition service
// Multi-source candidate chain, solving the problem of t2.gstatic.com failing to get icons for some Chinese sites:
// 1. t2.gstatic.com (international sites have the best quality)
// 2. api.iowen.cn (covers Chinese sites comprehensively)
// 3. favicon.im
// 4. Directly fetch origin/favicon.ico

export const getFaviconCandidates = (targetUrl: string): string[] => {
  try {
    const normalized = targetUrl.startsWith('http') ? targetUrl : 'https://' + targetUrl;
    const u = new URL(normalized);
    const encoded = encodeURIComponent(u.origin);
    return [
      // 本站服务端代理（Cloudflare Functions），部署后国内直连可用；dev 预览无 functions 时 404 自动顺延
      `/api/favicon?url=${encodeURIComponent(normalized)}`,
      `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encoded}&size=128`,
      `https://api.iowen.cn/favicon/${u.hostname}.png`,
      `https://favicon.im/${u.hostname}?larger=true`,
      `${u.origin}/favicon.ico`,
    ];
  } catch {
    return [];
  }
};

// Preload probe: returns the URL of the first successfully loaded candidate, returns null if all fail
export const probeFavicon = (targetUrl: string, timeoutMs = 5000): Promise<string | null> => {
  const candidates = getFaviconCandidates(targetUrl);
  if (candidates.length === 0) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    let pending = candidates.length;

    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    candidates.forEach((src) => {
      const img = new Image();
      const done = (src: string | null) => {
        if (settled) return;
        if (src) {
          clearTimeout(timer);
          finish(src);
        } else if (--pending === 0) {
          clearTimeout(timer);
          finish(null);
        }
      };
      img.onload = () => done(src);
      img.onerror = () => done(null);
      img.src = src;
    });
  });
};

export const getHostname = (targetUrl: string): string => {
  try {
    const normalized = targetUrl.startsWith('http') ? targetUrl : 'https://' + targetUrl;
    return new URL(normalized).hostname;
  } catch {
    return '';
  }
};
