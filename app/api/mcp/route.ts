import { createMcpHandler } from 'mcp-handler'

import {
    registerAll,
    SERVER_NAME,
    SERVER_VERSION
} from '@/src/mcp/register'

// generate-image가 Buffer를 사용하므로 Edge 런타임에서는 동작하지 않는다.
export const runtime = 'nodejs'
export const maxDuration = 60

const HF_TOKEN_HEADER = 'x-hf-token'

// mcp-handler 1.x가 사용하는 StreamableHTTPServerTransport는 extra.requestInfo를
// 채우지 않아 도구 콜백에서 헤더를 읽을 수 없다. 그래서 요청마다 헤더를 읽어
// 클로저로 주입한다 (핸들러 생성 비용은 도구 등록뿐이다).
function handler(req: Request) {
    const hfToken = req.headers.get(HF_TOKEN_HEADER) ?? process.env.HF_TOKEN

    return createMcpHandler(
        (server) => registerAll(server, { hfToken, transport: 'http' }),
        { serverInfo: { name: SERVER_NAME, version: SERVER_VERSION } },
        { basePath: '/api', disableSse: true }
    )(req)
}

export { handler as GET, handler as POST, handler as DELETE }
