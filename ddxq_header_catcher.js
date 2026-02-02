/*
 * ddxq_header_catcher.js
 * 功能：当打开叮咚农场时, 自动抓取并储存最新的会话信息 (包括喂食ID)。
 * 运行环境: Shadowrocket (Surge, QX兼容)
 *
 * 最后更新: 2026-02-02
 */
const scriptName = "叮咚信息抓取";
// 使用单一的Key来储存所有会话信息, 方便管理
const ddxq_session_key = "ddxq_session"; 

// 统一API的通知函数
const notify = (title, subtitle, body) => {
  const finalTitle = `[${scriptName}] ${title}`;
  if (typeof $notify !== 'undefined') { // Quantumult X or compatible
    $notify(finalTitle, subtitle, body);
  } else if (typeof $notification !== 'undefined') { // Surge
    $notification.post(finalTitle, subtitle, body);
  } else {
    console.log(`${finalTitle}\n${subtitle}\n${body}`);
  }
};

// 脚本主逻辑
if ($response && $request.url.includes('/api/v2/userguide/detail')) {
    if ($response.statusCode !== 200) {
        notify("抓取失败", "❌", `服务器响应状态码错误: ${$response.statusCode}`);
        $done();
        return;
    }

    try {
        const body = JSON.parse($response.body);
        if (body.code === 0 && body.data && body.data.feed && body.data.baseSeed) {
            const propsId = body.data.feed.propsId;
            const seedId = body.data.baseSeed.seedId;

            if (!propsId || !seedId) {
                 notify("抓取不完整", "🟡", "响应中缺少喂食ID (propsId/seedId)。");
                 return;
            }

            const session = {
                headers: $request.headers,
                url: $request.url,
                propsId: propsId,
                seedId: seedId,
                timestamp: new Date().toISOString()
            };

            const sessionStr = JSON.stringify(session);
            const success = $persistentStore.write(sessionStr, ddxq_session_key);

            if (success) {
                console.log(`${scriptName}: 成功抓取并储存了最新的会话信息 (包括喂食ID)。`);
                notify("叮咚信息更新成功", "✅", "所有信息 (包括喂食ID) 已自动捕获。");
            } else {
                 notify("储存失败", "❌", "无法将叮咚会话信息写入 $persistentStore。");
            }

        } else {
            notify("抓取失败", "❌", `响应体中未找到有效数据或结构不符: ${body.msg || '未知错误'}`);
        }
    } catch (e) {
        notify("脚本异常", "❌", `处理响应数据时出错: ${e.message}`);
    } finally {
        $done({});
    }
} else {
    // 如果脚本在非预期情况下被触发，则不做任何事
    $done({});
}