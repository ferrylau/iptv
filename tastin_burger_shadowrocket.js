/*
 * 塔斯汀汉堡(支付宝)自动签到脚本
 * 兼容 Quantumult X, Surge, Shadowrocket (小火箭)
 *
 * by Gemini-AI, 2026-02-08
 *
 * ========== 配置说明 ==========
 * 1. 在你的App中, 添加一个持久化存储 (key-value)。
 *    - Key: tsthb_alipay_token
 *    - Value: 格式为 {"token": "你的user-token", "cookie": "你的acw_tc=...cookie"}
 *    - (高级) 多账号: 可用换行分隔多个JSON对象。
 * 2. 或者, 直接在下方 "手动账号" 中填入你的 token 和 cookie。
 *
 * ========== 获取方式 ==========
 * 使用抓包工具 (如 Fiddler, Surge, Quantumult X) 获取对 sss-alipay.tastientech.com 的请求。
 * 1. user-token: 从请求头的 'user-token' 字段获取。
 * 2. cookie: 从请求头的 'Cookie' 字段获取, 通常以 'acw_tc=' 开头。
 *
 * 注意: token 和 cookie 都有时效性, 过期后需要重新抓取。
 *
 */

// --- 多账号配置 ---
const configs = [{
    name: "自动抓取账号",
    useStore: true,
}, {
    name: "手动账号 (示例)",
    useStore: false,
    account: {
        "token": "sss3369c62c-be8d-469b-a8be-ca8ef43418d9", // 替换成你自己的
        "cookie": "acw_tc=0a0572c117705228621437286e485bae45031d6d5461cb325729f6d92434ad" // 替换成你自己的
    }
}, ];

// --- 脚本核心 (以下无需修改) ---

const SCRIPT_NAME = "塔斯汀汉堡签到 (支付宝)";
const TOKEN_KEY = "tsthb_alipay_token";
const API_HOST = 'https://sss-alipay.tastientech.com';

const COMMON_HEADERS = {
    'version': '3.58.0',
    'channel': '1',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22G100 ChannelId(8) Ariver/1.1.0 AliApp(AP/10.8.30.6000) Nebula WK RVKType(0) AlipayDefined(nt:WIFI,ws:390|844|3.0,ac:ss) AlipayClient/10.8.30.6000 Language/zh-Hans Region/CN NebulaX/1.0.0 XRiver/10.2.58.1',
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

    if (isPost) {
        fullOptions.headers['Content-Type'] = 'application/json';
        if (typeof fullOptions.body !== 'string') {
            fullOptions.body = JSON.stringify(fullOptions.body || {});
        }
    }

    const isSurge = typeof $httpClient !== 'undefined';
    for (let i = 0; i < 3; i++) {
        try {
            let response;
            if (typeof $task !== 'undefined') { // For Quantumult X
                response = await $task.fetch(fullOptions);
            } else if (isSurge) { // For Surge, Shadowrocket
                response = await new Promise((resolve, reject) => {
                    const callback = (error, resp, data) => error ? reject(error) : resolve({ statusCode: resp.status, body: data });
                    if (isPost) $httpClient.post(fullOptions, callback);
                    else $httpClient.get(fullOptions, callback);
                });
            } else {
                throw new Error("Unsupported environment: This script is designed for Quantumult X, Surge, or Shadowrocket.");
            }

            if (response.statusCode >= 200 && response.statusCode < 300) {
                return JSON.parse(response.body);
            } else {
                throw `HTTP Error: ${response.statusCode}`;
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
                try {
                    const lines = storedConfigRaw.split('\n').filter(Boolean);
                    lines.forEach((line, index) => {
                        const acc = JSON.parse(line);
                        processed.push({ name: `${cfg.name} ${index + 1}`, ...acc });
                    });
                } catch (e) {
                     console.log(`解析持久化配置失败, 请检查格式: ${e}`);
                }
            }
        } else {
            if (cfg.account && cfg.account.token && cfg.account.cookie) {
                processed.push({ name: cfg.name, ...cfg.account });
            }
        }
    }
    return processed;
}

// --- Business Logic ---

async function getMemberDetail(token, cookie) {
    const data = await sendRequest({
        url: `${API_HOST}/api/intelligence/member/getMemberDetail/sign`,
        headers: { 'user-token': token, 'Cookie': cookie }
    });
    if (data.code === 200 && data.result) return data.result;
    throw new Error(`获取会员信息失败: ${data.msg || '未知错误'}`);
}

async function getActivityId(token, cookie, memberInfo) {
    const data = await sendRequest({
        url: `${API_HOST}/api/minic/shop/intelligence/banner/c/list/sign`,
        method: 'POST',
        body: {
            "shopId": 12810,
            "birthday": memberInfo.birthday || "1990-01-01",
            "gender": memberInfo.gender || 0,
            "nickName": memberInfo.nickName || "tastin-user",
            "phone": memberInfo.phone
        },
        headers: { 'user-token': token, 'Cookie': cookie }
    });
    const banner = data.result?.find(item => item.bannerName?.includes("积分签到"));
    const activityId = banner ? JSON.parse(banner.jumpPara).activityId : null;
    if (activityId) return activityId;
    throw new Error('获取 activityId 失败');
}

async function checkSignInfo(token, cookie, activityId) {
    const data = await sendRequest({
        url: `${API_HOST}/api/sign/member/signInfoV2`,
        method: 'POST',
        body: { "activityId": activityId },
        headers: { 'user-token': token, 'Cookie': cookie }
    });
    if (data.code === 200 && data.result?.signMemberInfo) return data.result.signMemberInfo;
    throw new Error(`检查签到状态失败: ${data.msg || '未知错误'}`);
}


async function doSign(token, cookie, activityId, phone) {
    const data = await sendRequest({
        url: `${API_HOST}/api/sign/member/signV2`,
        method: 'POST',
        body: { "activityId": activityId, "memberPhone": phone },
        headers: { 'user-token': token, 'Cookie': cookie }
    });
    if (data.code === 200 && data.result?.rewardInfoList) return data.result.rewardInfoList[0];
    if (data.msg?.includes("已签到")) return { alreadySigned: true };
    throw new Error(`签到失败: ${data.msg || '未知错误'}`);
}

// --- Main Execution ---
(async () => {
    console.log(`\n--- ${SCRIPT_NAME} 开始 ---`);
    const accountsToRun = processConfigs();

    if (accountsToRun.length === 0) {
        console.log("没有找到有效的账号配置, 请检查。");
        $.notify(SCRIPT_NAME, "无有效账号", `请在脚本中手动配置, 或在App持久化存储中为 "${TOKEN_KEY}" 添加配置。`);
        return;
    }

    console.log(`共找到 ${accountsToRun.length} 个账号, 开始执行...`);
    let summary = [];

    for (const account of accountsToRun) {
        const { name, token, cookie } = account;
        let log = `[${name}] `;
        try {
            const memberInfo = await getMemberDetail(token, cookie);
            const activityId = await getActivityId(token, cookie, memberInfo);
            const signInfo = await checkSignInfo(token, cookie, activityId);

            if (signInfo.todaySign) {
                log += `ℹ️ 今天已签到, 连续 ${signInfo.continuousNum} 天。`;
            } else {
                const signResult = await doSign(token, cookie, activityId, memberInfo.phone);
                if (signResult.alreadySigned) {
                     log += `ℹ️ 今天已经签到过了。`;
                } else {
                    const rewardName = signResult.rewardName || `${signResult.point} 积分`;
                    log += `✅ 签到成功, 获得: ${rewardName}`;
                }
            }
        } catch (error) {
            log += `❌ 执行失败: ${error.message || error}`;
        }
        console.log(log);
        summary.push(log);
    }

    console.log("\n--- 任务执行完毕 ---");
    $.notify(SCRIPT_NAME, "任务报告", summary.join('\n'));

})().catch((e) => {
    console.log(e);
}).finally(() => {
    $.done();
});
