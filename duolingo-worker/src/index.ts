/**
 * Duolingo Unlocker Worker (Request Mimic Version - Fixed)
 * 
 * 核心逻辑：
 * 1. 仅对 POST 请求（Batch）进行拦截和伪装。
 * 2. 对 GET 子请求伪装成 PATCH：
 *    - 方法: GET -> PATCH
 *    - URL: 移除 ?fields=...
 *    - Body: 将 fields 内容存入 {"fields": "..."}
 * 3. 拦截 analytics (excess.duolingo.com) 请求并返回假成功响应
 */

export interface Env {}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        console.log(`\n---\n[WORKER] Incoming: ${request.method} ${request.url}`);

        const url = new URL(request.url);

        // =================================================================================
        // 1. ROUTING & BLOCKING
        // Determine target host or block the request based on path prefix.
        // =================================================================================
        let targetHost = '';
        if (url.pathname.startsWith('/ios-api-2/')) {
            targetHost = 'ios-api-2.duolingo.cn';
            url.pathname = url.pathname.substring('/ios-api-2'.length);

            // Block /plus-promotions/ requests, as per user rules.
            if (url.pathname.startsWith('/plus-promotions/')) {
                console.log('[WORKER] BLOCKING /plus-promotions/ request.');
                return new Response(null, { status: 403, statusText: 'Forbidden' });
            }
        } else if (url.pathname.startsWith('/goals-api/')) {
            targetHost = 'goals-api.duolingo.cn';
            url.pathname = url.pathname.substring('/goals-api'.length);
        } else if (url.pathname.startsWith('/excess-api/')) {
            console.log('[WORKER] Intercepting analytics request.');
            const responseMessage = 'Successfully submitted 1 event(s)';
            return new Response(responseMessage, { status: 200, headers: { 'Content-Type': 'text/plain;charset=iso-8859-1' } });
        } else if (url.pathname.startsWith('/simg-ssl.duolingo.com/')) {
            // Block simg-ssl domain, as per user rules.
            console.log('[WORKER] BLOCKING simg-ssl.duolingo.com request.');
            return new Response(null, { status: 403, statusText: 'Forbidden' });
        }
        else {
            return new Response('Request not routed. No matching path prefix.', { status: 404 });
        }
        
        console.log(`[WORKER] Routing to target host: ${targetHost}, new path: ${url.pathname}`);
        url.hostname = targetHost;
        url.protocol = 'https';

        // =================================================================================
        // 2. REQUEST MODIFICATION & INTERCEPTION
        // Modify the request before sending it upstream, or intercept it entirely.
        // =================================================================================
        let modifiedRequestBody: string | null = null;
        let isTargetBatch = false; // This flag tracks if the response needs to be modified.

        if (targetHost === 'ios-api-2.duolingo.cn') {
            // Case A: Intercept subscription-catalog requests and return an empty response.
            const userSubscriptionCatalogRegex = /^\/2023-05-23\/users\/[0-9]+\/subscription-catalog/;
            if (userSubscriptionCatalogRegex.test(url.pathname)) {
                console.log('[WORKER] Intercepting subscription-catalog request. Returning empty JSON.');
                return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
            }

            // Case B: Handle batch POST requests for energy or user data.
            const isPost = request.method === 'POST';
            const isBatchEndpoint = url.pathname === '/2023-05-23/batch';
            if (isPost && isBatchEndpoint) {
                try {
                    const requestClone = request.clone();
                    const requestBody = await requestClone.text();

                    // Case B.1: If it's an energy request, intercept and fake success.
                    if (requestBody.includes('/remove-energy') || requestBody.includes('/refill-energy')) {
                        console.log('[WORKER] Intercepting energy request. Faking success.');
                        const reqObj = JSON.parse(requestBody);
                        const numRequests = reqObj.requests?.length || 0;
                        const fakeSubResponse = { status: 200, body: "{}", headers: { "Content-Type": "application/json" } };
                        const fakeResponses = Array(numRequests).fill(fakeSubResponse);
                        const fakeResponseBody = JSON.stringify({ responses: fakeResponses });
                        return new Response(fakeResponseBody, { status: 200, headers: { 'Content-Type': 'application/json;charset=UTF-8' } });
                    }
                    
                    // Case B.2: If it's the main user data request, flag it and modify its sub-requests.
                    isTargetBatch = requestBody.includes('gemsConfig');
                    if (isTargetBatch) {
                        console.log('[WORKER] Target batch request identified for response modification.');
                        modifiedRequestBody = requestBody;
                        let reqObj = JSON.parse(requestBody);
                        if (reqObj.requests && Array.isArray(reqObj.requests)) {
                            reqObj.requests = reqObj.requests.map((subReq: any) => {
                                if (subReq.method === 'GET' && subReq.url.includes('/users/') && subReq.url.includes('fields=')) {
                                    console.log('[WORKER] Mimicking PATCH for sub-request.');
                                    const urlParts = subReq.url.split('?');
                                    const params = new URLSearchParams(urlParts[1] || '');
                                    return { ...subReq, method: 'PATCH', url: urlParts[0], body: JSON.stringify({ fields: params.get('fields') }) };
                                }
                                return subReq;
                            });
                            modifiedRequestBody = JSON.stringify(reqObj);
                        }
                    }
                } catch (e) {
                    console.error('[WORKER] Error processing batch request body:', e);
                }
            }
        }

        // =================================================================================
        // 3. UPSTREAM FETCH
        // Send the (potentially modified) request to the target server.
        // =================================================================================
        const headersForUpstream = new Headers(request.headers);
        headersForUpstream.set('Host', targetHost);
        
        const upstreamRequest = new Request(url.toString(), {
            method: request.method,
            headers: headersForUpstream,
            redirect: 'follow',
            body: modifiedRequestBody ?? ((request.method !== 'GET' && request.method !== 'HEAD') ? request.body : null),
        });

        let response = await fetch(upstreamRequest);
        
        // =================================================================================
        // 4. RESPONSE MODIFICATION
        // If the request was flagged as our target, modify the response.
        // =================================================================================
        if (!isTargetBatch) {
            return response; // Not our target, return original response.
        }

        if (!response.headers.get("content-type")?.includes("application/json")) {
            console.log('[WORKER] Target batch response is not JSON, returning original.');
            return response;
        }

        try {
            let obj: any = await response.json();
            if (obj.responses && Array.isArray(obj.responses)) {
                obj.responses.forEach((res: any, idx: number) => {
                    if (res.body && typeof res.body === 'string' && (res.body.includes('subscriberLevel') || res.body.includes('energyConfig'))) {
                        console.log(`[WORKER] Modifying sub-response ${idx} to unlock Plus features.`);
                        try {
                            let innerBody = JSON.parse(res.body);
                            
                            // Apply Plus Unlocks
                            innerBody.subscriberLevel = "MAX";
                            innerBody.hasPlus = true;
                            if (innerBody.energyConfig) {
                                innerBody.energyConfig.energy = 500;
                                innerBody.energyConfig.maxEnergy = 500;
                            }
                            if (innerBody.trackingProperties) {
                                innerBody.trackingProperties.has_item_premium_subscription = true;
                            }
                            innerBody.plusDiscounts = null; // Use null for safer modification
                            innerBody.adsConfig = null;     // Use null for safer modification

                            res.body = JSON.stringify(innerBody);
                            if (res.headers) {
                                delete res.headers['content-encoding'];
                                delete res.headers['content-length'];
                            }
                        } catch (e) {
                            console.log(`[WORKER] Sub-response ${idx} parsing failed:`, e);
                        }
                    }
                });
            }

            const finalBody = JSON.stringify(obj);
            const finalHeaders = new Headers(response.headers);
            
            // Robust Header Handling: Recalculate length and remove conflicting headers
            finalHeaders.delete('content-encoding');
            finalHeaders.delete('etag');
            finalHeaders.set('Content-Length', new TextEncoder().encode(finalBody).length.toString());

            return new Response(finalBody, {
                status: response.status,
                headers: finalHeaders
            });
        } catch (e) {
            console.log('[WORKER] Error modifying final response body:', e);
            return response; // Return original on failure
        }
    },
};

