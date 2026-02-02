/*
 * ddxq_header_catcher.js (Simple - userguide URL)
 * 功能：当打开叮咚农场时, 自动抓取并储存最新的会话信息 (URL和请求头)。
 * 运行环境: Shadowrocket (Surge, QX兼容)
 * 触发方式: 打开叮咚买菜App, 进入“叮咚农场”。
 *
 * 最后更新: 2026-02-02
 */
const scriptName = "叮咚信息抓取";
const ddxq_headers_key = "ddxq_headers"; // 用于储存请求头的Key
const ddxq_url_key = "ddxq_url";         // 用于储存请求URL的Key

const notify = (title, subtitle, body) => {
  const finalTitle = `[${scriptName}] ${title}`;
  console.log(`${finalTitle} ${subtitle} ${body}`);
  if (typeof $notify !== 'undefined') {
    $notify(finalTitle, subtitle, body);
  } else if (typeof $notification !== 'undefined') {
    $notification.post(finalTitle, subtitle, body);
  }
};

if ($request && $request.url.includes('/api/v2/userguide/detail')) {
    try {
        const headers = JSON.stringify($request.headers);
        const url = $request.url;

        $persistentStore.write(headers, ddxq_headers_key);
        $persistentStore.write(url, ddxq_url_key);

        console.log(`${scriptName}: 成功抓取并储存了最新的URL和请求头。`);
        notify("叮咚信息更新成功", "✅", "请求头和URL已捕获, 请在签到脚本中手动填写喂食ID。");

    } catch (e) {
        notify("脚本异常", "❌", `处理请求时出错: ${e.message}`);
    } finally {
        $done({});
    }
} else {
    $done({});
}