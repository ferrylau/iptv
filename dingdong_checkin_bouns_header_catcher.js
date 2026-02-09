/*
 * DingDong Check-in Bonus - Header Catcher
 *
 * This script is designed to capture the cookie and request body for DingDong check-in.
 * It's intended to be used with a request-capturing environment like Shadowrocket.
 *
 * Trigger on URL: https://maicai.api.ddxq.mobi/point/home
 */

const COOKIE_KEY = "dd_bonus_cookie";
const BODY_KEY = "dd_bonus_body";

if ($request && $request.headers && $request.headers['Cookie'] && $request.url) {
    const cookieValue = $request.headers['Cookie'];
    const bodyValue = $request.url.split('?')[1];

    if (!bodyValue) {
        $notification.post("叮咚签到凭证抓取失败❌", "请求URL中未找到所需参数", "请确认触发了正确的接口。");
    } else {
        // Write the captured data to persistent storage.
        const cookieSuccess = $persistentStore.write(cookieValue, COOKIE_KEY);
        const bodySuccess = $persistentStore.write(bodyValue, BODY_KEY);

        if (cookieSuccess && bodySuccess) {
            $notification.post("叮咚签到凭证抓取成功✅", "Cookie和Body已保存", "请禁用此抓取脚本，避免重复抓取。");
        } else {
            $notification.post("叮咚签到凭证保存失败❌", "请检查小火箭权限", "无法写入持久化存储。");
        }
    }
} else {
    // This message is useful for debugging if the script runs but doesn't find the header.
    $notification.post("叮咚签到凭证未找到", "请求中缺少Cookie或URL参数", "请确认您已正确触发App中的接口。");
}

// Signal that the script is done and the original request can proceed.
$done({});
