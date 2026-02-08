/*
 * Tastin Burger Check-in Script
 * 兼容: Quantumult X, Surge, Shadowrocket, Node.js
 * 
 * 移植自网络上的Python脚本, 感谢原作者。
 * 由Gemini重构为多环境兼容版本。
 *
 * ========== 配置说明 ==========
 * 1. 【微信】抓包 sss-web.tastientech.com 获取请求头中的 user-token。
 * 2. 根据你的环境，选择以下一种方式配置：
 *
 *    - 方法一 (推荐, 适合所有环境):
 *      直接修改下面 `manual_tokens` 数组, 填入你的token。
 *
 *    - 方法二 (Quantumult X):
 *      在QX的 `[task_local]` 下配置好任务后, 到 `构造请求` 中添加一个key为 `tsthb_wechat_token` 的持久化值。
 *
 *    - 方法三 (Surge / Shadowrocket):
 *      在 `[Script]` 段落中, 使用 `script-update-interval=-1` 来避免脚本被意外更新。
 *
 *    - 方法四 (Node.js):
 *      在脚本同目录下创建一个名为 `tsthb_token.txt` 的文件, 每行放一个token。
 */

// --- 手动配置区 ---
// 在这里填入你从【微信小程序】抓取的user-token
const manual_tokens = [
    "sssfcd295ed-d69b-44e4-97e0-b71b1dd95707", // 替换成你自己的token
    // "如果你有更多账号，可以加在这里",
];
// --- 手动配置区结束 ---


// --- 兼容层与环境变量 ---
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;
const isQuantumultX = typeof $task !== 'undefined';
const isSurge = typeof $httpClient !== 'undefined';
const isShadowrocket = isSurge; // Shadowrocket 兼容 Surge 的 $httpClient

const SCRIPT_NAME = "塔斯汀汉堡签到";
const TOKEN_KEY = "tsthb_wechat_token"; // 使用新key, 避免和旧的支付宝token混淆
const NODE_TOKEN_FILE = "tsthb_token.txt";
const API_HOST = 'https://sss-web.tastientech.com';
const VERSION = '1.46.8';

const $ = {
    read: (key) => {
        if (isQuantumultX) return $prefs.valueForKey(key);
        if (isSurge) return $persistentStore.read(key);
        if (isNode) {
            try {
                return require('fs').readFileSync(key, 'utf8');
            } catch (e) {
                return null;
            }
        }
        return null;
    },
    notify: (title, subtitle = '', body = '') => {
        if (isQuantumultX) $notify(title, subtitle, body);
        if (isSurge) $notification.post(title, subtitle, body);
        if (isNode) {
            // 在Node.js中, 我们也把通知内容加入日志列表
            const message = `\n---\n${title}\n${subtitle}\n${body}\n---`;
            console.log(message);
        }
    },
    done: (value = {}) => {
        if (isQuantumultX || isSurge) $done(value);
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
    
    // 自动处理 POST 请求的 body 和 Content-Type
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
    } else if (isQuantumultX) {
        const resp = await $task.fetch(requestOptions);
        response = { body: resp.body, status: resp.statusCode, headers: resp.headers };
    } else if (isNode) {
        const resp = await require('node-fetch')(requestOptions.url, requestOptions);
        response = { body: await resp.text(), status: resp.status, headers: resp.headers.raw() };
    }

    try {
        // 尝试将所有响应体解析为JSON
        response.body = JSON.parse(response.body);
    } catch (e) {
        // 如果解析失败, 保持其为纯文本
    }

    return response;
}

// --- 业务逻辑 (与之前相同, 仅微调) ---
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
        if (lq.result.rewardInfoList[0].rewardName == null) {
            myprint(`签到情况：获得 ${lq.result.rewardInfoList[0].point} 积分`);
        } else {
            myprint(`签到情况：获得 ${lq.result.rewardInfoList[0].rewardName}`);
        }
    } else {
        myprint(`签到情况：${lq.msg}`);
    }
}

// --- 主函数 ---
(async () => {
    myprint(`============📣 ${SCRIPT_NAME} 📣============`);
    
    let tokens_to_run = [];
    // 1. 从持久化存储中读取
    const stored_token = $.read(TOKEN_KEY);
    if(stored_token) tokens_to_run.push(stored_token);
    
    // 2. 在Node.js中, 从文件读取
    if (isNode) {
        const file_tokens = $.read(NODE_TOKEN_FILE);
        if (file_tokens) tokens_to_run = tokens_to_run.concat(file_tokens.split('\n'));
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
        $.notify(SCRIPT_NAME, '执行完毕', all_print_list.join('\n'));
    }
})().catch((e) => {
    console.error(e);
    $.notify(SCRIPT_NAME, '脚本执行异常', e.message);
}).finally(() => {
    $.done();
});
