/**
 * DUOLINGO 精准重定向脚本
 * 根据请求体判断是否为 'gemsConfig' batch 请求，并重定向到本地 Python 服务。
 * 其他请求直接放行到原始 Duolingo 服务器。
 */

// 确保在 http-request 脚本中使用，并且 requires-body = true
if (typeof $request !== 'undefined' && $request.url && $request.body) {
    const targetUrlPath = '/2023-05-23/batch';
    const upstreamProxyUrl = 'https://la.828762.xyz:8433'; // 指向你的 Caddy/Python 服务器

    const requestUrl = $request.url;
    const requestBody = $request.body; // 注意：$request.body 在 Shadowrocket 中是字符串

    // 判断是否是目标 URL 和是否包含 'gemsConfig'
    if (requestUrl.includes(targetUrlPath) && requestBody.includes('gemsConfig')) {
        // 重定向目标请求

        // --- URL parsing workaround for environments without URL constructor ---
        // 找到第一个 '/' 在协议之后，提取 path 部分
        const pathStartIndex = requestUrl.indexOf('/', requestUrl.indexOf('://') + 3); 
        const pathAndQuery = pathStartIndex !== -1 ? requestUrl.substring(pathStartIndex) : '/';
        // --- End of workaround ---

        const newUrl = upstreamProxyUrl + pathAndQuery; // 使用 workaround 的 pathAndQuery
        
        console.log(`[DUO-REQ] ✅ 发现目标 'gemsConfig' batch 请求，重定向至: ${newUrl}`);

        $done({
            url: newUrl,
            headers: $request.headers, // 保持原始头部
            body: $request.body // 保持原始请求体
        });
    } else {
        // 非目标请求，直接放行到原始地址
        console.log(`[DUO-REQ] ❌ 非目标请求，直接放行: ${requestUrl}`);
        $done({}); // $done({}) 不修改请求，让其发往原始目的地
    }
} else {
    // 如果没有 $request 或 $request.body，也直接放行
    console.log(`[DUO-REQ] ❌ 脚本条件不满足，直接放行。`);
    $done({});
}