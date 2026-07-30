import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import './globals.css'

export const metadata: Metadata = {
    title: 'my-mcp-server',
    description:
        'Streamable HTTP 방식으로 동작하는 MCP 서버. 인사/계산/시간/지오코딩/날씨/이미지 생성 도구를 제공합니다.'
}

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="ko">
            <body>{children}</body>
        </html>
    )
}
