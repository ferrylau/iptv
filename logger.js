// DuoSimpleCounter.js
const url = $request.url;
// 不读取 $response.body，极大提高拦截成功率
console.log(`[DUOLIN_COUNT] 🔔 拦截到请求: ${url}`);
$done({});
