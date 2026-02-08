/*
 * Tastin Burger Check-in Script
 *
 * This is a JavaScript port of the Python script provided by the user.
 * It targets the 'sss-web.tastientech.com' endpoint and uses token-only authentication.
 *
 * How to use:
 * 1. Add your user-token(s) captured from the WeChat Mini Program to the `TOKENS` array below.
 * 2. Run with `node tastin_burger_shadowrocket.js`.
 */

// --- Configuration ---
// 在这里填入你从微信小程序抓取的user-token
const TOKENS = [
    "sssfcd295ed-d69b-44e4-97e0-b71b1dd95707", // 替换成你自己的token
    // "如果你有更多账号，可以加在这里",
];

// --- 脚本核心 (移植自Python) ---

const fetch = require('node-fetch');

const SCRIPT_NAME = "塔斯汀汉堡签到 (JS移植版)";
const API_HOST = 'https://sss-web.tastientech.com';
const VERSION = '1.46.8'; // 版本号来自Python脚本

// 简单的日志记录器
const all_print_list = [];
function myprint(message) {
    console.log(message);
    all_print_list.push(message);
}

// 移植自Python的 qdsj(ck) 函数
async function getActivityId(token) {
    const headers = {
        'user-token': token,
        'version': VERSION,
        'channel': '1',
        'Content-Type': 'application/json'
    };
    const body = JSON.stringify({
        "shopId": "",
        "birthday": "",
        "gender": 0,
        "nickName": null,
        "phone": ""
    });

    const response = await fetch(`${API_HOST}/api/minic/shop/intelligence/banner/c/list`, {
        method: 'POST',
        headers: headers,
        body: body
    });
    const data = await response.json();

    if (data.code !== 200) {
        throw new Error(`获取activityId失败 (API): ${data.msg || '未知错误'}`);
    }

    const banner = data.result?.find(item => item.bannerName?.includes("签到"));
    if (banner && banner.jumpPara) {
        try {
            const activityId = JSON.parse(banner.jumpPara).activityId;
            if (activityId) {
                myprint(`获取到本月签到代码：${activityId}`);
                return activityId;
            }
        } catch(e) {
            // JSON parsing might fail
        }
    }
    
    throw new Error('无法从服务器返回中找到activityId');
}

// 移植自Python的 yx(ck) 函数
async function runCheckIn(token) {
    let activityId = '';
    try {
        activityId = await getActivityId(token);
    } catch (e) {
        myprint(`${e.message}。将采用备用计算方法。`);
        // Python脚本中的备用逻辑
        const danqryid = 59;
        const d1 = new Date("2025-05-01");
        const d2 = new Date();
        const months = (d2.getFullYear() - d1.getFullYear()) * 12 + d2.getMonth() - d1.getMonth();
        activityId = danqryid + months;
        myprint(`计算得出备用ID: ${activityId}`);
    }

    const headers = {
        'user-token': token,
        'version': VERSION,
        'channel': '1'
    };

    // 获取会员信息
    const memberResponse = await fetch(`${API_HOST}/api/intelligence/member/getMemberDetail`, { headers });
    const memberData = await memberResponse.json();

    if (memberData.code !== 200) {
        throw new Error(`获取会员信息失败: ${memberData.msg || '未知错误'}`);
    }
    
    myprint(`账号：${memberData.result.phone} 登录成功`);
    const phone = memberData.result.phone;

    // 执行签到
    const signHeaders = { ...headers, 'Content-Type': 'application/json' };
    const signBody = JSON.stringify({
        "activityId": activityId,
        "memberName": "",
        "memberPhone": phone
    });

    const signResponse = await fetch(`${API_HOST}/api/sign/member/signV2`, {
        method: 'POST',
        headers: signHeaders,
        body: signBody
    });
    const lq = await signResponse.json();

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

// 移植自Python的 main() 函数
async function main() {
    const tokens_to_run = TOKENS.filter(t => t && t.length > 10); // Basic validation
    if (tokens_to_run.length === 0) {
        console.log('请在脚本顶部的 TOKENS 数组中填入您从微信小程序抓取的有效user-token。');
        return;
    }
    
    myprint(`查找到 ${tokens_to_run.length} 个账号`);
    let accountIndex = 1;
    for (const token of tokens_to_run) {
        try {
            myprint(`\n--- 开始登录第 ${accountIndex} 个账号 ---`);
            await runCheckIn(token);
            myprint(`--- 第 ${accountIndex} 个账号执行完毕 ---`);
        } catch (e) {
            myprint(`第 ${accountIndex} 个账号执行失败: ${e.message}`);
        }
        accountIndex++;
    }
}

// --- 执行 ---
console.log(`============📣 ${SCRIPT_NAME} 📣============`);
main().finally(() => {
    console.log('\n============📣 执行完毕 📣============');
    // 如果需要发送通知, 可以在这里调用通知函数
    // 例如: sendNotify(SCRIPT_NAME, all_print_list.join('\n'))
});