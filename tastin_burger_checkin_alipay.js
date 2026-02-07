/*
 * 塔斯汀汉堡(支付宝)自动签到脚本
 * 兼容 Quantumult X, Surge, Shadowrocket (小火箭)
 *
 * by Gemini-AI, 2026-02-07
 *
 * ========== 配置说明 ==========
 * 本脚本支持两种账号配置方式:
 *
 * 1. 自动抓取 (主账号):
 *    - 在下方 configs 数组中, 保留 `useStore: true` 的配置。
 *    - 在你的App中, 添加一个持久化配置项 (key-value)。
 *    - Key: tsthb_alipay_token
 *    - Value: 填写一个JSON字符串, 或多个JSON按行分隔。
 *      单账号: {"token": "你的user-token", "cookie": "你的cookie"}
 *      多账号(换行分隔):
 *      {"token": "账号1...", "cookie": "账号1..."}
 *      {"token": "账号2...", "cookie": "账号2..."}
 *
 * 2. 手动配置 (额外账号):
 *    - 在下方 configs 数组中, 参照 "手动账号 (示例)" 的格式。
 *    - 设置 `useStore: false`。
 *    - 直接在 `account` 对象中填入 token 和 cookie。
 *    - 你可以添加任意多个手动配置的账号。
 *
 */

// --- 多账号配置 ---
const configs = [{
    name: "主账号 (自动抓取)",
    useStore: true,
    // 此配置会自动从您在App持久化存储中设置的 tsthb_alipay_token 读取信息
}, {
    name: "手动账号",
    useStore: false,
    account: {
        "token": "sss3369c62c-be8d-469b-a8be-ca8ef43418d9",
        "cookie": "acw_tc=0a0572b617704704610668530e4bca491f08e13b136922e351523d19ce449d"
    }
    // 若有更多账号, 可复制粘贴此对象, 继续在下方添加
}, ];

// --- 脚本核心逻辑 (以下部分无需修改) ---

const SCRIPT_NAME = "塔斯汀汉堡签到 (支付宝)";
const TOKEN_KEY = "tsthb_alipay_token"; // App 持久化存储的 Key

const API_HOST = 'https://sss-alipay.tastientech.com';
const COMMON_HEADERS = {
    'Host': 'sss-alipay.tastientech.com',
    'version': '3.58.0',
    'channel': '1',
    // 'Content-Type': 'application/json', // 由HTTP客户端自动管理, 解决415错误
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22G100 ChannelId(17) Ariver/1.1.0 AliApp(AP/10.8.30.6000) Nebula WK RVKType(0) AlipayDefined(nt:WIFI,ws:390|780|3.0,ac:ss) AlipayClient/10.8.30.6000 Language/zh-Hans Region/CN NebulaX/1.0.0 XRiver/10.2.58.1',
};

const $ = {
    read: (key) => {
        if (typeof $persistentStore !== 'undefined') return $persistentStore.read(key);
        if (typeof $prefs !== 'undefined') return $prefs.valueForKey(key);
        return undefined;
    },
    notify: (title, subtitle = '', body = '') => {
        if (typeof $notify !== 'undefined') $notify(title, subtitle, body);
        else if (typeof $notification !== 'undefined' && $notification.post) $notification.post(title, subtitle, body);
        else console.log(`\n---\n${title}\n${subtitle}\n${body}\n---`);
    },
    done: (value = {}) => {
        if (typeof $done !== 'undefined') $done(value);
    }
};

async function sendRequest(options) {
    const fullOptions = {
        timeout: 10000,
        method: 'GET',
        headers: { ...COMMON_HEADERS,
            ...options.headers
        },
        ...options,
    };

    const isPost = fullOptions.method.toUpperCase() === 'POST';

    // 最终解决方案: 根据抓包, POST请求必须明确指定Content-Type
    if (isPost) {
        fullOptions.headers['Content-Type'] = 'application/json';
    }

    if (isPost && typeof fullOptions.body !== 'string') {
        fullOptions.body = JSON.stringify(fullOptions.body || {});
    }

    const isSurge = typeof $httpClient !== 'undefined';
    for (let i = 0; i < 3; i++) {
        try {
            let response;
            if (typeof $task !== 'undefined') {
                response = await $task.fetch(fullOptions);
            } else if (isSurge) {
                response = await new Promise((resolve, reject) => {
                    const callback = (error, resp, data) => error ? reject(error) : resolve({
                        statusCode: resp.status,
                        body: data
                    });
                    if (isPost) $httpClient.post(fullOptions, callback);
                    else $httpClient.get(fullOptions, callback);
                });
            } else throw new Error("Unsupported environment");

            if (response.statusCode >= 200 && response.statusCode < 300) {
                return JSON.parse(response.body);
            } else {
                throw `HTTP Error: ${response.statusCode}, Body: ${response.body}`;
            }
        } catch (error) {
            console.log(`[sendRequest] failed (attempt ${i + 1}/3): ${error}`);
            if (i < 2) await new Promise(resolve => setTimeout(resolve, 2000));
            else throw error;
        }
    }
}

function processConfigs() {
    const processed = [];
    const storedConfigRaw = $.read(TOKEN_KEY);

    for (const cfg of configs) {
        if (cfg.useStore) {
            if (storedConfigRaw) {
                console.log(`[${cfg.name}] 检测到持久化存储信息, 开始解析...`);
                let storedAccounts = [];
                try {
                    storedAccounts = JSON.parse(storedConfigRaw);
                    if (!Array.isArray(storedAccounts)) storedAccounts = [storedAccounts];
                } catch (e) {
                    storedAccounts = storedConfigRaw.split('\n').map(line => line.trim()).filter(line => line).map(line => {
                        try {
                            return JSON.parse(line);
                        } catch (parseError) {
                            console.log(`解析单行JSON配置失败: "${line}"`);
                            return null;
                        }
                    }).filter(Boolean);
                }
                storedAccounts.forEach((acc, index) => {
                    processed.push({
                        name: `${cfg.name} ${index + 1}`,
                        ...acc
                    });
                });
            } else {
                console.log(`[${cfg.name}] 配置为自动抓取, 但未找到持久化信息, 跳过。`);
            }
        } else {
            if (cfg.account && cfg.account.token && cfg.account.token !== '在此填入第二个账号的token') {
                processed.push({
                    name: cfg.name,
                    ...cfg.account
                });
            } else {
                console.log(`[${cfg.name}] 手动账号未配置或配置不完整, 跳过。`);
            }
        }
    }
    return processed;
}

// --- 业务逻辑函数 ---

async function getActivityId(token, cookie) {
    console.log("正在获取动态 activityId...");
    const data = await sendRequest({
        url: `${API_HOST}/api/minic/shop/intelligence/banner/c/list/sign`,
        method: 'POST',
        headers: {
            'user-token': token,
            'Cookie': cookie
        },
        body: {
            "shopId": 12810,
            "birthday": "",
            "gender": 0,
            "nickName": "",
            "phone": ""
        },
    });
    if (data.code === 200 && data.result) {
        const banner = data.result.find(item => item.bannerName && item.bannerName.includes("积分签到"));
        if (banner && banner.jumpPara) {
            const params = JSON.parse(banner.jumpPara);
            if (params.activityId) {
                console.log(`获取成功, activityId: ${params.activityId}`);
                return params.activityId;
            }
        }
    }
    throw new Error('获取 activityId 失败');
}

async function checkSignInfo(token, cookie, activityId) {
    console.log("正在检查签到状态...");
    const data = await sendRequest({
        url: `${API_HOST}/api/sign/member/signInfoV2`,
        method: 'POST',
        headers: {
            'user-token': token,
            'Cookie': cookie
        },
        body: {
            "activityId": activityId
        }
    });
    if (data.code === 200 && data.result?.signMemberInfo) {
        if (data.result.signMemberInfo.todaySign === true) {
            return `ℹ️ 今天已签到, 连续签到 ${data.result.signMemberInfo.continuousNum} 天。`;
        }
        return false;
    }
    throw new Error(`检查签到状态失败: ${data.msg || '未知错误'}`);
}

async function getMemberDetail(token, cookie) {
    console.log("正在获取会员信息 (手机号)...");
    const data = await sendRequest({
        url: `${API_HOST}/api/intelligence/member/getMemberDetail`,
        method: 'GET',
        headers: {
            'user-token': token,
            'Cookie': cookie
        },
    });
    if (data.code === 200 && data.result?.phone) {
        return data.result.phone;
    }
    throw new Error(`获取手机号失败: ${data.msg || '未知错误'}`);
}

async function doSign(token, cookie, activityId, phone) {
    console.log("正在执行签到...");
    const data = await sendRequest({
        url: `${API_HOST}/api/sign/member/signV2`,
        method: 'POST',
        headers: {
            'user-token': token,
            'Cookie': cookie
        },
        body: {
            "activityId": activityId,
            "memberPhone": phone
        }
    });
    if (data.code === 200 && data.result?.rewardInfoList) {
        const reward = data.result.rewardInfoList[0];
        const name = reward.rewardName || `${reward.point} 积分`;
        return `✅ 签到成功, 获得: ${name}`;
    }
    if (data.msg && data.msg.includes("已签到")) return `ℹ️ 今天已经签到过了。`;
    throw new Error(`签到失败: ${data.msg || '未知错误'}`);
}

// --- 主执行函数 ---
(async () => {
    console.log(`\n--- ${SCRIPT_NAME} 开始 ---`);
    const accountsToRun = processConfigs();

    if (accountsToRun.length === 0) {
        console.log("没有找到有效的账号配置, 请检查。");
        $.notify(SCRIPT_NAME, "无有效账号", `请在脚本中手动配置, 或在App中为 "${TOKEN_KEY}" 添加配置。`);
        return;
    }

    console.log(`共找到 ${accountsToRun.length} 个有效账号, 开始执行...`);
    const summary = [];

    for (let i = 0; i < accountsToRun.length; i++) {
        const account = accountsToRun[i];
        const { name, token, cookie } = account;
        console.log(`\n=============== 开始为 [${name}] 执行任务 ===============`);

        if (!token || !cookie) {
            summary.push(`[${name}] ❌ 配置不完整, 缺少 "token" 或 "cookie"。`);
            continue;
        }

        try {
            console.log(`[${name}] 步骤 1/4: 获取活动ID...`);
            const activityId = await getActivityId(token, cookie);

            console.log(`[${name}] 步骤 2/4: 检查签到状态...`);
            const signStatus = await checkSignInfo(token, cookie, activityId);

            if (signStatus) {
                console.log(`[${name}] ${signStatus}`);
                summary.push(`[${name}] ${signStatus}`);
                continue;
            }

            console.log(`[${name}] 步骤 3/4: 获取会员手机号...`);
            const phone = await getMemberDetail(token, cookie);
            
            console.log(`[${name}] 步骤 4/4: 执行签到...`);
            const signResult = await doSign(token, cookie, activityId, phone);
            
            console.log(`[${name}] ${signResult}`);
            summary.push(`[${name}] ${signResult}`);

        } catch (error) {
            const errorMsg = `❌ 执行失败: ${error.message || error}`;
            console.log(errorMsg);
            summary.push(`[${name}] ${errorMsg}`);
        }
        if (i < accountsToRun.length - 1) await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log("\n--- 任务执行完毕 ---");
    $.notify(SCRIPT_NAME, "任务报告", summary.join('\n'));

})().finally(() => {
    $.done();
});
