/*
 * ddxq_header_catcher.js (URL Finder - 调试专用)
 */
const scriptName = "URL Finder";

if ($request && $request.url.includes('farm.api.ddxq.mobi')) {
    console.log(`[${scriptName}] Detected URL: ${$request.url}`);
}

$done({});