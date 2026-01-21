/**
 * DUOLIN 请求端强力探测
 * 目的：验证小火箭到底能捕捉到几次并发请求发送
 */

const url = $request.url;
const method = $request.method;
const headers = $request.headers;

console.log(`[DUOLIN_REQ] 🚀 >>> 拦截到请求发送 <<<`);
console.log(`[DUOLIN_REQ] 🌐 URL: ${url}`);
console.log(`[DUOLIN_REQ] 🛠 Method: ${method}`);

// 打印关键 Header，确认身份校验和连接类型
const trackHeaders = ['Authorization', 'X-Duolingo-Service', 'Content-Type', 'Connection'];
trackHeaders.forEach(h => {
    if (headers[h] || headers[h.toLowerCase()]) {
        console.log(`[DUOLIN_REQ] 🔑 ${h}: ${headers[h] || headers[h.toLowerCase()]}`);
    }
});

// 如果有请求体(POST)，打印长度看是否有区别
if ($request.body) {
    console.log(`[DUOLIN_REQ] 📦 Request Body Size: ${$request.body.length}`);
}

$done({});
