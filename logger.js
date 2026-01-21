/**
 * DUOLIN 快速扫描器 - 解决日志中断问题
 */

const body = $response.body;
if (!body || !body.trim().startsWith('{')) $done({});

try {
    const obj = JSON.parse(body);
    console.log(`[DUOLIN_SNIFFER] 📥 拦截成功 | URL: ${$request.url.split('/batch')[0]}`);

    if (obj.responses && obj.responses[0] && obj.responses[0].body) {
        let resBody = obj.responses[0].body;
        
        // 如果 body 是字符串，尝试解包
        if (typeof resBody === 'string' && resBody.trim().startsWith('{')) {
            console.log(`[DUOLIN_SNIFFER] 🔍 正在解压 Batch[0].body 字符串...`);
            const subObj = JSON.parse(resBody);
            
            // 1. 打印第一层所有的 Key，帮我们定位大模块
            const topKeys = Object.keys(subObj);
            console.log(`[DUOLIN_SNIFFER] 📦 第一层字段预览: ${topKeys.slice(0, 30).join(", ")}`);

            // 2. 定向搜索你发现的关键字段
            if (subObj.subscriberLevel) {
                console.log(`[DUOLIN_SNIFFER] 🎯 发现等级字段: ${subObj.subscriberLevel}`);
            }
            if (subObj.gems !== undefined) {
                console.log(`[DUOLIN_SNIFFER] 🎯 发现宝石字段: ${subObj.gems}`);
            }

            // 3. 针对你图片中看到的结构，尝试进入 user 对象
            if (subObj.user) {
                console.log(`[DUOLIN_SNIFFER] 👤 发现 user 对象，包含字段: ${Object.keys(subObj.user).slice(0, 20).join(", ")}`);
                if (subObj.user.subscriberLevel) {
                    console.log(`[DUOLIN_SNIFFER] 🎯 user.subscriberLevel: ${subObj.user.subscriberLevel}`);
                }
            }
        }
    } else {
        console.log(`[DUOLIN_SNIFFER] 🧊 Batch[0] 不含有效的 JSON body`);
    }
} catch (e) {
    console.log(`${[DUOLIN_SNIFFER]} ❌ 报错: ${e.message}`);
}

$done({});
