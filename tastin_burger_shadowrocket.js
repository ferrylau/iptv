/*
 * Tastin Burger Check-in Script
 * 兼容: Node.js, Surge, Shadowrocket
 *
 * ========== 配置说明 ==========
 * 1. 【微信】抓包 sss-web.tastientech.com 获取请求头中的 user-token。
 * 2. 根据你的环境，选择以下一种方式配置：
 *
 *    - 方法一 (推荐, 适合所有环境):
 *      直接修改下面 `manual_tokens` 数组, 填入你的token。
 *
 *    - 方法二 (Surge / Shadowrocket):
 *      在App的持久化存储(persistent store)中，添加一个key为 `tsthb_wechat_token` 的键值对，值为你的token。
 *
 *    - 方法三 (Node.js):
 *      在脚本同目录下创建一个名为 `tsthb_token.txt` 的文件, 每行放一个token。
 */

// --- 手动配置区 ---
// 在这里填入你从【微信小程序】抓取的user-token
const manual_tokens = [
    "sssfcd295ed-d69b-44e4-97e0-b71b1dd95707", // 替换成你自己的token
];
// --- 手动配置区结束 ---


// --- 兼容层与环境变量 ---
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;
const isSurge = typeof $httpClient !== 'undefined';
const isShadowrocket = isSurge; // Shadowrocket 兼容 Surge 的 $httpClient

const SCRIPT_NAME = "塔斯汀汉堡签到";
const TOKEN_KEY = "tsthb_wechat_token"; // 用于Surge/小火箭的持久化存储key
const API_HOST = 'https://sss-web.tastientech.com';
const VERSION = '1.46.8';

const $ = {
    read: (key) => {
        if (isSurge) return $persistentStore.read(key);
        return null;
    },
    notify: (title, subtitle = '', body = '') => {
        if (isSurge) $notification.post(title, subtitle, body);
        if (isNode) console.log(`\n---\n${title}\n${subtitle}\n${body}\n---`);
    },
    done: (value = {}) => {
        if (isSurge) $done(value);
        if (isNode) process.exit(0);
    }
};

// --- 网络请求 ---
async function sendRequest(options) {
    const defaultHeaders = {
        'version': VERSION,
        'channel': '1',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    };
    
    const requestOptions = {
        ...options,
        headers: { ...defaultHeaders, ...options.headers },
    };
    
    if (requestOptions.method?.toUpperCase() === 'POST' && typeof requestOptions.body === 'object') {
        requestOptions.body = JSON.stringify(requestOptions.body);
        requestOptions.headers['Content-Type'] = 'application/json';
    }

    let response = {};

    if (isSurge || isShadowrocket) {
        response = await new Promise((resolve, reject) => {
            const method = requestOptions.method?.toUpperCase() === 'POST' ? 'post' : 'get';
            $httpClient[method](requestOptions, (error, resp, data) => {
                if (error) return reject(error);
                resolve({ body: data, status: resp.statusCode, headers: resp.headers });
            });
        });
    } else if (isNode) {
        const resp = await require('node-fetch')(requestOptions.url, requestOptions);
        response = { body: await resp.text(), status: resp.status, headers: resp.headers.raw() };
    }

    try {
        response.body = JSON.parse(response.body);
    } catch (e) {
        // 解析失败则保持原样
    }

    return response;
}

// --- 业务逻辑 ---
const all_print_list = [];
function myprint(message) {
    console.log(message);
    all_print_list.push(message);
}

async function getActivityId(token) {
    const response = await sendRequest({
        url: `${API_HOST}/api/minic/shop/intelligence/banner/c/list`,
        method: 'POST',
        body: { "shopId": "", "birthday": "", "gender": 0, "nickName": null, "phone": "" },
        headers: { 'user-token': token }
    });

    if (response.status !== 200 || response.body.code !== 200) {
        throw new Error(`获取activityId失败 (API): ${response.body.msg || '未知错误'}`);
    }

    const banner = response.body.result?.find(item => item.bannerName?.includes("签到"));
    if (banner && banner.jumpPara) {
        const activityId = JSON.parse(banner.jumpPara).activityId;
        if (activityId) {
            myprint(`获取到本月签到代码：${activityId}`);
            return activityId;
        }
    }
    throw new Error('无法从服务器返回中找到activityId');
}

async function runCheckIn(token) {
    let activityId = '';
    try {
        activityId = await getActivityId(token);
    } catch (e) {
        myprint(`${e.message}。将采用备用计算方法。`);
        const danqryid = 59;
        const d1 = new Date("2025-05-01");
        const d2 = new Date();
        const months = (d2.getFullYear() - d1.getFullYear()) * 12 + d2.getMonth() - d1.getMonth();
        activityId = danqryid + months;
        myprint(`计算得出备用ID: ${activityId}`);
    }

    const memberResponse = await sendRequest({
        url: `${API_HOST}/api/intelligence/member/getMemberDetail`,
        headers: { 'user-token': token }
    });

    if (memberResponse.status !== 200 || memberResponse.body.code !== 200) {
        throw new Error(`获取会员信息失败: ${memberResponse.body.msg || '未知错误'}`);
    }
    
    const memberInfo = memberResponse.body.result;
    myprint(`账号：${memberInfo.phone} 登录成功`);

    const signResponse = await sendRequest({
        url: `${API_HOST}/api/sign/member/signV2`,
        method: 'POST',
        body: { "activityId": activityId, "memberPhone": memberInfo.phone },
        headers: { 'user-token': token }
    });
    
    const lq = signResponse.body;
    if (lq.code === 200) {
        const reward = lq.result.rewardInfoList[0];
        const rewardName = reward.rewardName || `${reward.point} 积分`;
        myprint(`签到情况：获得 ${rewardName}`);
    } else {
        myprint(`签到情况：${lq.msg}`);
    }
}

// --- 主函数 ---
(async () => {
    myprint(`============📣 ${SCRIPT_NAME} 📣============`);
    
    let tokens_to_run = [];
    
    // 1. 从 Surge/小火箭 的持久化存储中读取
    if (isSurge) {
        const stored_token = $.read(TOKEN_KEY);
        if(stored_token) tokens_to_run.push(stored_token);
    }

    // 3. 从手动配置中读取
    tokens_to_run = tokens_to_run.concat(manual_tokens);

    // 4. 清理和去重
    const valid_tokens = tokens_to_run.map(t => t.trim()).filter(t => t && t.length > 10);
    const unique_tokens = [...new Set(valid_tokens)];

    if (unique_tokens.length === 0) {
        myprint('未找到任何有效Token, 请根据脚本说明进行配置。');
        $.notify(SCRIPT_NAME, '配置错误', '未找到任何有效Token, 请检查配置。');
    } else {
        myprint(`查找到 ${unique_tokens.length} 个账号, 开始执行...`);
        let accountIndex = 1;
        for (const token of unique_tokens) {
            try {
                myprint(`\n--- 开始登录第 ${accountIndex} 个账号 ---`);
                await runCheckIn(token);
                myprint(`--- 第 ${accountIndex} 个账号执行完毕 ---`);
            } catch (e) {
                myprint(`第 ${accountIndex} 个账号执行失败: ${e.message}`);
            }
            accountIndex++;
        }
        myprint('\n============📣 执行完毕 📣============');
        if(!isNode) $.notify(SCRIPT_NAME, '执行完毕', all_print_list.join('\n'));
    }
})().catch((e) => {
    console.error(e);
    $.notify(SCRIPT_NAME, '脚本执行异常', e.message);
}).finally(() => {
    $.done();
});