/*
 * This script is designed to capture the user-token for the Tastin' Burger check-in.
 * It's intended to be used with a request-capturing environment like Shadowrocket.
 */

// The key used to store the token, must match the check-in script.
const TOKEN_KEY = "tsthb_wechat_token";

if ($request && $request.headers && $request.headers['user-token']) {
    const tokenValue = $request.headers['user-token'];
    
    // Write the captured token to persistent storage.
    const success = $persistentStore.write(tokenValue, TOKEN_KEY);
    
    if (success) {
        $notification.post("塔斯汀Token获取成功✅", "user-token已保存", "请禁用此抓取模块/脚本，避免重复抓取。");
    } else {
        $notification.post("塔斯汀Token保存失败❌", "请检查小火箭权限", "无法写入持久化存储。");
    }
} else {
    // This message is useful for debugging if the script runs but doesn't find the header.
    $notification.post("塔斯汀Token未找到", "请求头中无user-token", "请确认您已打开塔斯汀微信小程序并触发了API请求。");
}

// Signal that the script is done and the original request can proceed.
$done({});
