/*
 * Gzip/JSON 打印脚本
 * 作用：打印出请求 URL 和解压后的响应体，不做任何修改
 */

const url = $request.url;
const method = $request.method;
const body = $response.body;

// 确保响应体存在，并且是文本类型
if (body && typeof body === 'string') {
    // 打印请求方法和 URL
    console.log(`[LOGGER] METHOD: ${method}, URL: ${url}`);
    
    try {
        // 尝试解析为 JSON，如果成功，就打印格式化的 JSON
        const jsonBody = JSON.parse(body);
        console.log("【JSON BODY】:\n" + JSON.stringify(jsonBody, null, 2));
    } catch (e) {
        // 如果不是 JSON，就打印文本内容
        console.log("【TEXT BODY】:\n" + body.substring(0, 500) + (body.length > 500 ? "..." : ""));
    }
} else {
    // 打印空内容或非文本内容
    console.log(`[LOGGER] URL: ${url} 响应体为空或非文本数据。`);
}

// 必须调用 $done({})，并且不带任何修改参数，表示不对流量做任何修改，直接放行。
$done({});
