/*
 * ddxq_header_catcher.js (v3 - URL-based)
 * 功能：通过抓取喂食URL, 自动储存所有会话信息 (包括喂食ID)。
 * 运行环境: Shadowrocket (Surge, QX兼容)
 * 触发方式: 在叮咚农场手动点击一次“喂食”。
 *
 * 最后更新: 2026-02-02
 */
const scriptName = "叮咚信息抓取";
const ddxq_session_key = "ddxq_session"; 

// 从URL中提取参数的辅助函数
function getURLParam(url, name) {
    if (!url) return null;
    const reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
    const match = url.substr(url.indexOf("?") + 1).match(reg);
    if (match) return decodeURIComponent(match[2]);
    return null;
}

const notify = (title, subtitle, body) => {
  const finalTitle = `[${scriptName}] ${title}`;
  console.log(`${finalTitle} ${subtitle} ${body}`);
  if (typeof $notify !== 'undefined') {
    $notify(finalTitle, subtitle, body);
  } else if (typeof $notification !== 'undefined') {
    $notification.post(finalTitle, subtitle, body);
  }
};

if ($request && $request.url.includes('/api/v2/props/feed')) {
    try {
        const url = $request.url;
        console.log(`${scriptName}: 成功匹配到喂食URL: ${url}`);

        // 从URL中解析所有我们需要的参数
        const propsId = getURLParam(url, 'propsId');
        const seedId = getURLParam(url, 'seedId');
        
        if (!propsId || !seedId) {
            notify("抓取失败", "❌", "喂食URL中缺少 propsId 或 seedId。");
            $done();
            return;
        }

        const session = {
            headers: $request.headers,
            url: url, // 保存完整的URL以备后用
            propsId: propsId,
            seedId: seedId,
            timestamp: new Date().toISOString()
        };

        const sessionStr = JSON.stringify(session);
        $persistentStore.write(sessionStr, ddxq_session_key);
        
        // 验证写入
        const writtenData = $persistentStore.read(ddxq_session_key);
        if (writtenData === sessionStr) {
            console.log(`${scriptName}: 成功抓取并储存了所有会话信息。`);
            notify("叮咚信息更新成功", "✅", "所有信息已通过喂食请求自动捕获。");
        } else {
            notify("储存失败", "❌", "写入验证失败, $persistentStore可能无法正常工作。");
        }

    } catch (e) {
        notify("脚本异常", "❌", `处理请求时出错: ${e.message}`);
    } finally {
        $done({});
    }
} else {
    $done({});
}