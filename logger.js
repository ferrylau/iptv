/**
 * Duolingo iOS App 终极补丁 (支持 Batch 嵌套字符串解析)
 * 功能：解锁 MAX 等级、无限能量/红心、注入 Super 订阅凭证
 */

let body = $response.body;
if (!body) $done({});

try {
    let obj = JSON.parse(body);

    // --- 核心修改逻辑：针对用户数据对象进行字段重写 ---
    const patchData = (data) => {
        if (!data || typeof data !== 'object') return;

        // 1. 修改身份等级（针对你抓到的 subscriberLevel）
        if (data.subscriberLevel !== undefined) {
            data.subscriberLevel = "MAX"; 
        }

        // 2. 针对能量系统 (Energy) 的全覆盖
        if (data.energy !== undefined) data.energy = 5;
        if (data.unlimitedEnergyAvailable !== undefined) {
            data.unlimitedEnergyAvailable = true;
        }
        if (data.energyContext) {
            data.energyContext.isUnlimitedEnergyEnabled = true;
            data.energyContext.unlimitedEnergyAvailable = true;
        }

        // 3. 针对红心系统 (Hearts) 的全覆盖 (PC/Web 兼容)
        if (data.health) {
            data.health.unlimitedHeartsAvailable = true;
            data.health.hearts = 5;
            if (data.health.predictionContext) {
                data.health.predictionContext.isUnlimitedHeartsEnabled = true;
            }
        }

        // 4. 注入 Super 订阅凭证 (让 App UI 彻底变色)
        data.hasPlus = true;
        data.isMax = true;
        if (!data.trackingProperties) data.trackingProperties = {};
        data.trackingProperties.has_item_premium_subscription = true;
        
        if (!data.shopItems) data.shopItems = {};
        data.shopItems["premium_subscription"] = {
            "itemName": "premium_subscription",
            "subscriptionInfo": {
                "vendor": "STRIPE",
                "renewing": true,
                "isFamilyPlan": true,
                "expectedExpiration": 9999999999000
            }
        };
    };

    // --- 逻辑分流：处理 Batch 嵌套字符串 或 普通请求 ---
    if (obj.responses && Array.isArray(obj.responses)) {
        // 针对你抓到的 {"responses": [{"body": "{...}"}]} 结构
        obj.responses.forEach(res => {
            if (res.body && typeof res.body === 'string' && res.body.startsWith('{')) {
                try {
                    let subObj = JSON.parse(res.body);
                    patchData(subObj);
                    res.body = JSON.stringify(subObj); // 重新缝合回字符串
                } catch (e) {
                    console.log("Sub-body parse failed");
                }
            }
        });
    } else {
        // 如果是直接返回用户对象的普通请求
        patchData(obj);
    }

    $done({ body: JSON.stringify(obj) });

} catch (e) {
    console.log("DuoMax overall error: " + e);
    $done({});
}
