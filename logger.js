/**
 * DUOLIN 内存优化版 (专门针对 50M 内存限制)
 */

if (typeof $response !== 'undefined' && $response.body) {
    let body = $response.body;
    
    // 1. 快速过滤：如果包太小或者不包含关键字，直接退出，不消耗内存
    if (body.length < 500 || body.indexOf('subscriberLevel') === -1) {
        $done({});
    } else {
        // 2. 使用更简单的字符串替换，而不是复杂的捕获组正则
        // 这样可以极大地降低内存占用
        try {
            let m = body;
            
            // 处理转义格式 (最占用内存的部分)
            if (m.indexOf('"responses"') !== -1) {
                m = m.replace(/\\"subscriberLevel\\":\\".*?\\"/g, '\\"subscriberLevel\\":\\"SUPER\\"')
                    // .replace(/\\"gems\\":\d+/g, '\\"gems\\":8888')
                     .replace(/\\"energy\\":\d+/g, '\\"energy\\":500')
                     .replace(/\\"maxEnergy\\":\d+/g, '\\"maxEnergy\\":500')
                     .replace(/\\"allowPersonalizedAds\\":true/g, '\\"allowPersonalizedAds\\":false')
                     .replace(/\\"isActivated\\":true/g, '\\"isActivated\\":false')                     
                     .replace(/\\"plus_super_branding\\":false/g, '\\"plus_super_branding\\":true');
            }
            
            // 处理非转义格式
            m = m.replace(/"gems":\d+/g, '"gems":8888')
                 .replace(/"subscriberLevel":".*?"/g, '"subscriberLevel":"SUPER"');

            $done({ body: m });
        } catch (e) {
            console.log("[DUOLIN] 内存溢出风险，跳过本次修改");
            $done({});
        }
    }
} else {
    $done({});
}