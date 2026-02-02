/*
 * ddxq_id_catcher.js
 * 功能：作为 http-response 脚本, 从 userguide 请求的响应体中抓取 propsId 和 seedId。
 * 运行环境: Shadowrocket (Surge, QX兼容)
 *
 * 最后更新: 2026-02-02
 */
const scriptName = "叮咚ID抓取";
const ddxq_props_id_key = "ddxq_props_id";
const ddxq_seed_id_key = "ddxq_seed_id";

const notify = (title, subtitle, body) => {
  const finalTitle = `[${scriptName}] ${title}`;
  if (typeof $notify !== 'undefined') {
    $notify(finalTitle, subtitle, body);
  } else if (typeof $notification !== 'undefined') {
    $notification.post(finalTitle, subtitle, body);
  } else {
    console.log(`${finalTitle} ${subtitle} ${body}`);
  }
};

if ($response && $response.body && $request.url.includes('/api/v2/userguide/detail')) {
    if ($response.statusCode !== 200) {
        notify("抓取失败", "❌", `服务器响应码: ${$response.statusCode}`);
        $done();
        return;
    }

    try {
        const body = JSON.parse($response.body);
        if (body.code === 0 && body.data) {
            const propsId = body.data.feed?.propsId;
            const seedId = body.data.baseSeed?.seedId;

            if (propsId && seedId) {
                $persistentStore.write(propsId, ddxq_props_id_key);
                $persistentStore.write(seedId, ddxq_seed_id_key);
                console.log(`${scriptName}: 成功抓取并储存了喂食ID。`);
                // 为了不和主脚本的通知混淆, 这个通知可以设为静默或只在日志中显示
                // notify("ID抓取成功", "✅", `propsId和seedId已获取。`);
            } else {
                notify("抓取不完整", "🟡", "响应中缺少喂食ID。");
            }
        } else {
            notify("解析失败", "❌", "响应体结构不符或code不为0。");
        }
    } catch (e) {
        notify("脚本异常", "❌", `处理响应时出错: ${e.message}`);
    } finally {
        $done({});
    }
} else {
    $done({});
}