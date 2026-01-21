/**
 * DUOLIN 域名全量探测脚本
 * 目标：记录 *.duolingo.com 和 *.duolingo.cn 的所有 Batch 结构
 */

const url = $request.url;
const body = $response.body;
const logPrefix = `[DUOLIN_SNIFFER]`;

if (!body || !body.trim().startsWith('{')) {
    $done({});
}

try {
    const obj = JSON.parse(body);
    console.log(`${logPrefix} 📥 拦截到请求: ${url}`);

    // 递归探测函数：记录所有包含关键信息的路径
    const sniff = (data, path) => {
        if (!data || typeof data !== 'object') return;

        // 记录当前层级的 Key，方便分析结构
        const keys = Object.keys(data);
        if (keys.includes('gems') || keys.includes('subscriberLevel') || keys.includes('energy')) {
            console.log(`${logPrefix} 🎯 发现关键字段! 路径: ${path} | 字段内容: ${JSON.stringify(data)}`);
        }

        // 继续向下探测
        keys.forEach(key => {
            if (data[key] && typeof data[key] === 'object') {
                sniff(data[key], `${path}.${key}`);
            }
        });
    };

    if (obj.responses && Array.isArray(obj.responses)) {
        console.log(`${logPrefix} 📦 检测到 Batch 结构，子响应数: ${obj.responses.length}`);
        obj.responses.forEach((res, index) => {
            if (res.body && typeof res.body === 'string' && res.body.trim().startsWith('{')) {
                try {
                    const subObj = JSON.parse(res.body);
                    console.log(`${logPrefix} 🔍 正在扫描 Batch[${index}] 的嵌套 Body...`);
                    sniff(subObj, `Batch[${index}].body`);
                } catch (e) {
                    console.log(`${logPrefix} ⚠️ Batch[${index}] 内容无法解析为 JSON`);
                }
            }
        });
    } else {
        sniff(obj, "Root");
    }

} catch (e) {
    console.log(`${logPrefix} ❌ 探测解析失败: ${e.message}`);
}

$done({});
