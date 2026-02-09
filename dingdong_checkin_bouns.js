/*
 * DingDong Check-in Bonus Script
 * 兼容: Node.js, Surge, Shadowrocket
 *
 * ========== 配置说明 ==========
 * 1. 使用 dingdong_checkin_bouns_header_catcher.js 抓取 Cookie 和 Body。
 * 2. 脚本会自动从持久化存储中读取凭证进行签到。
 *
 */

// --- 兼容层与环境变量 ---
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;
const isSurge = typeof $httpClient !== 'undefined';

const SCRIPT_NAME = "叮咚买菜签到";
const COOKIE_KEY = "dd_bonus_cookie";
const BODY_KEY = "dd_bonus_body";

const $ = {
    read: (key) => {
        if (isSurge) return $persistentStore.read(key);
        return null;
    },
    notify: (title, subtitle = '', body = '') => {
        if (isSurge) $notification.post(title, subtitle, body);
        if (isNode) console.log(`---${title}${subtitle}${body}---`);
    },
    done: (value = {}) => {
        if (isSurge) $done(value);
        if (isNode) process.exit(0);
    }
};

// --- 业务逻辑与日志 ---
const all_print_list = [];
function myprint(message) {
    console.log(message);
    all_print_list.push(message);
}

// --- 网络请求 ---
async function sendRequest(options) {
    const defaultHeaders = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 xzone/9.15.1 station_id/5500fe01916edfe0738b4e43',
    };

    const requestOptions = {
        ...options,
        headers: { ...defaultHeaders, ...options.headers },
    };

    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            let response = {};

            if (isSurge) {
                response = await new Promise((resolve, reject) => {
                    const method = requestOptions.method?.toUpperCase() === 'POST' ? 'post' : 'get';
                    $httpClient[method](requestOptions, (error, resp, data) => {
                        if (error) return reject(new Error(`$httpClient错误: ${error}`));
                        resolve({ body: data, status: resp.statusCode, headers: resp.headers });
                    });
                });
            } else if (isNode) {
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('请求超时')), 5000) // 5秒超时
                );
                const fetchPromise = require('node-fetch')(requestOptions.url, requestOptions);
                
                const resp = await Promise.race([fetchPromise, timeoutPromise]);
                response = { body: await resp.text(), status: resp.status, headers: resp.headers.raw() };
            } else {
                throw new Error('Unsupported environment');
            }

            try {
                response.body = JSON.parse(response.body);
            } catch (e) {
                // Fails to parse, keep as text.
            }
            return response;

        } catch (error) {
            lastError = error;
            myprint(`[sendRequest] 第 ${attempt}/${maxRetries} 次尝试失败: ${error.message}`);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
            }
        }
    }
    throw lastError;
}

async function runCheckIn(cookie, body) {
    const options = {
        url: 'https://sunquan.api.ddxq.mobi/api/v2/user/signin/',
        method: 'POST',
        headers: {
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "zh-cn",
            "Connection": "keep-alive",
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": cookie,
            "Host": "sunquan.api.ddxq.mobi",
            "Origin": "https://activity.m.ddxq.mobi",
            "Referer": "https://activity.m.ddxq.mobi/",
        },
        body: body
    };

    const response = await sendRequest(options);

    if (response.status !== 200) {
        throw new Error(`签到请求失败，HTTP状态码: ${response.status}`);
    }

    const data = response.body;
    if (data.code === 0) {
        let msg = `签到成功，连续签到${data.data["sign_series"]}天，获取积分${data.data.point}`;
        if (data.data["ticket_money"]) {
          msg += `，优惠券${data.data["ticket_money"]}!`;
        } else {
          msg += "!";
        }
        myprint(msg);
    } else if (data.code === 9007) {
        myprint(`签到失败：Cookie已过期或无效。`);
    } else {
        myprint(`签到失败：${data.msg || '未知错误信息'}`);
    }
}

// --- 主函数 ---
(async () => {
    myprint(`============📣 ${SCRIPT_NAME} 📣============`);

    const cookie = $.read(COOKIE_KEY);
    const body = $.read(BODY_KEY);

    if (!cookie || !body) {
        myprint('未找到有效凭证, 请先根据说明运行抓取脚本。');
        $.notify(SCRIPT_NAME, '配置错误', '未找到有效凭证 (Cookie或Body)。');
    } else {
        myprint(`查找到 1 个账号, 开始执行...`);
        try {
            await runCheckIn(cookie, body);
            myprint(`--- 账号执行完毕 ---`);
        } catch (e) {
            myprint(`账号执行失败: ${e.message}`);
        }
        myprint(`============📣 执行完毕 📣============`);
        if(!isNode) $.notify(SCRIPT_NAME, '执行完毕', all_print_list.join('\n'));
    }
})().catch((e) => {
    console.error(e);
    $.notify(SCRIPT_NAME, '脚本执行异常', e.message);
}).finally(() => {
    $.done();
});
