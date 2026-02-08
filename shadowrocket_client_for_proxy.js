/*
 * 塔斯汀汉堡(支付宝)自动签到 - 客户端脚本 (配合 CF Worker 代理使用)
 *
 * by Gemini-AI, 2026-02-08
 *
 * ========== 使用说明 ==========
 * 1. 部署 `cf_proxy_worker.js` 脚本到 Cloudflare, 获取您的 Worker URL。
 * 2. 将下方的 CF_WORKER_URL 常量替换为您的 Worker URL。
 * 3. 像往常一样, 在小火箭等 App 中使用此脚本。
 * 4. 在脚本中配置您的 token 和 cookie, 或使用 App 的持久化存储。
 */

// --- 配置区域 ---
// ⚠️ 部署您的 cf_proxy_worker.js 后, 将下面的 URL 替换成您自己的 Worker 地址
const CF_WORKER_URL = "https://tastin-proxy.ferrylau23.workers.dev";

// --- 账号配置 ---
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

const SCRIPT_NAME = "塔斯汀签到(代理版)";
const TOKEN_KEY = "tsthb_alipay_token";

const COMMON_HEADERS = {
    'version': '3.58.0',
    'channel': '1',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22G100 ChannelId(8) Ariver/1.1.0 AliApp(AP/10.8.30.6000) Nebula WK RVKType(0) AlipayDefined(nt:WIFI,ws:390|844|3.0,ac:ss) AlipayClient/10.8.30.6000 Language/zh-Hans Region/CN NebulaX/1.0.0 XRiver/10.2.58.1',
    'Referer': 'https://2021003128634226.hybrid.alipay-eco.com/2021003128634226/0.3.2601261021.26/index.html#pages/launch/index',
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
    const targetUrl = options.url;
    
    const fullOptions = {
        ...options,
        url: CF_WORKER_URL, // 实际请求发送到我们的 Worker 代理
        headers: {
            ...COMMON_HEADERS,
            ...options.headers,
            'X-Target-URL': targetUrl, // 将真实目标地址放在自定义请求头中
        },
    };

    const isPost = fullOptions.method?.toUpperCase() === 'POST';
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
                    const callback = (error, resp, data) => error ? reject(error) : resolve({ statusCode: resp.status, body: data });
                    if (isPost) $httpClient.post(fullOptions, callback);
                    else $httpClient.get(fullOptions, callback);
                });
            } else {
                throw new Error("Unsupported environment.");
            }

            if (response.statusCode >= 200 && response.statusCode < 300) {
                return JSON.parse(response.body);
            } else {
                throw `代理请求失败: Status ${response.statusCode}, Body: ${response.body}`;
            }
        } catch (error) {
            console.log(`[sendRequest] failed (attempt ${i + 1}/3): ${error}`);
            if (i < 2) await new Promise(resolve => setTimeout(resolve, 2000));
            else throw error;
        }
    }
}

// --- Business Logic (No changes needed here) ---
const API_HOST = 'https://sss-alipay.tastientech.com';

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
        body: { "shopId": 12810, "birthday": memberInfo.birthday || "1990-01-01", "gender": memberInfo.gender || 0, "nickName": memberInfo.nickName || "tastin-user", "phone": memberInfo.phone },
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
    if (CF_WORKER_URL === "https://your-worker-name.your-subdomain.workers.dev") {
        console.log("❌ 请先将脚本中的 CF_WORKER_URL 常量替换为您自己的 Worker 地址!");
        $.notify(SCRIPT_NAME, "配置错误", "请先在脚本中替换为你自己的 Worker 地址。");
        return $.done();
    }

    const accountsToRun = processConfigs();
    if (accountsToRun.length === 0) {
        console.log("没有找到有效的账号配置, 请检查。");
        $.notify(SCRIPT_NAME, "无有效账号", `请在脚本中手动配置, 或在App持久化存储中为 "${TOKEN_KEY}" 添加配置。`);
        return $.done();
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
