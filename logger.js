/**
 * DUOLIN 强力正则替换版 (针对同URL并发包)
 */

let body = $response.body;

// 快速判断：如果 Body 连 JSON 特征都没有，直接放行
if (!body || body.length < 10) $done({});

try {
    // 打印当前 Body 的前 50 个字符，帮我们确认拦截的是哪一个包
    console.log(`[DUOLIN] 📥 拦截包长度: ${body.length} | 内容预览: ${body.substring(0, 50)}`);

    // --- 策略 A: 正则暴力替换 (最快，不解析 JSON) ---
    // 这种方法能极大地减少脚本执行时间，防止后续并发包漏抓
    if (body.includes('"gems"') || body.includes('"subscriberLevel"')) {
        console.log("[DUOLIN] 🎯 发现目标字段，执行正则替换...");
        
        body = body
            .replace(/"gems":\s*\d+/g, '"gems":999999')
            .replace(/"subscriberLevel":\s*".*?"/g, '"subscriberLevel":"MAX"')
            .replace(/"energy":\s*\d+/g, '"energy":5')
            .replace(/"unlimitedEnergyAvailable":\s*\w+/g, '"unlimitedEnergyAvailable":true');

        $done({ body }); 
    } else {
        // 如果正则没匹配到，再尝试解析一次 Batch 嵌套字符串 (针对图片里的结构)
        if (body.includes('"responses"')) {
            let obj = JSON.parse(body);
            let modified = false;
            obj.responses.forEach(res => {
                if (res.body && typeof res.body === 'string') {
                    // 对嵌套的 body 字符串再次执行正则替换
                    let original = res.body;
                    res.body = res.body
                        .replace(/"gems":\s*\d+/g, '"gems":999999')
                        .replace(/"subscriberLevel":\s*".*?"/g, '"subscriberLevel":"MAX"');
                    if (original !== res.body) modified = true;
                }
            });
            
            if (modified) {
                console.log("[DUOLIN] ✅ Batch 嵌套数据已修改");
                $done({ body: JSON.stringify(obj) });
            }
        }
    }
} catch (e) {
    console.log(`[DUOLIN] ⚠️ 处理出错: ${e.message}`);
}

$done({});
