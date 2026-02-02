/*
 * ddxq_header_catcher.js
 * 功能：当打开叮咚农场时, 自动抓取并储存最新的会话信息。
 * https://github.com/
 */
const scriptName = "叮咚信息抓取";
const ddxq_headers_key = "ddxq_headers"; // 用于储存请求头的Key
const ddxq_url_key = "ddxq_url";         // 用于储存请求URL的Key

if ($request && $request.url.includes('/api/v2/userguide/detail')) {
    try {
        const headers = JSON.stringify($request.headers);
        const url = $request.url;

        $prefs.setValueForKey(headers, ddxq_headers_key);
        $prefs.setValueForKey(url, ddxq_url_key);

        console.log(`${scriptName}: 成功抓取并储存了最新的URL和请求头。`);
        $notify(scriptName, "✅ 叮咚信息更新成功", "签到脚本现在可以使用最新的身份信息了。");
    } catch (e) {
        console.log(`${scriptName}: 脚本出现异常 - ${e.message}`);
        $notify(scriptName, "❌ 叮咚信息更新异常", `详情: ${e.message}`);
    }
}

$done({});
