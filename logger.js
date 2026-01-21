/**
 * DUOLIN 计数诊断脚本 (不解析版本)
 * 目的：统计拦截次数及包大小，排查并发漏抓问题
 */

const url = $request.url;
const body = $response.body;
const logPrefix = `[DUOLIN_COUNT]`;

// 增加一个全局计数器（在脚本多次运行间保持，部分插件支持）
if (typeof $duo_counter === 'undefined') {
    var $duo_counter = 1;
} else {
    $duo_counter++;
}

console.log(`${logPrefix} 🔔 第 ${$duo_counter} 次拦截到 Batch`);
console.log(`${logPrefix} 🌐 URL: ${url}`);

if (body) {
    // 仅计算长度，不解析内容，确保超大包也不会卡顿
    console.log(`${logPrefix} 📊 响应体大小: ${(body.length / 1024).toFixed(2)} KB`);
    
    // 快速检查关键字位置，但不解包
    const hasGems = body.indexOf('"gems"') !== -1;
    const hasLevel = body.indexOf('"subscriberLevel"') !== -1;
    console.log(`${logPrefix} 🔍 关键字段探测: gems(${hasGems}), level(${hasLevel})`);
} else {
    console.log(`${logPrefix} ⚠️ 响应体为空`);
}

$done({});
