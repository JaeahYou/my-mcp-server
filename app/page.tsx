import { SERVER_NAME, SERVER_VERSION } from '@/src/mcp/register'

import styles from './page.module.css'

const TOOLS = [
    { name: 'greet', description: '이름과 언어로 인사말 생성' },
    { name: 'calculator', description: '두 숫자의 사칙연산' },
    { name: 'get-time', description: 'timezone 또는 도시명의 현재 시각' },
    { name: 'geocode', description: '도시명을 위경도로 변환 (Open-Meteo)' },
    { name: 'get-weather', description: '위경도의 현재 날씨와 일별 예보' },
    {
        name: 'generate-image',
        description: '프롬프트로 이미지 생성 (FLUX.1-schnell)',
        needsToken: true
    }
]

const CURSOR_CONFIG = `{
  "mcpServers": {
    "${SERVER_NAME}": {
      "url": "https://<your-project>.vercel.app/api/mcp",
      "headers": {
        "x-hf-token": "hf_xxx"
      }
    }
  }
}`

export default function Home() {
    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <span className={styles.badge}>Streamable HTTP</span>
                <h1 className={styles.title}>{SERVER_NAME}</h1>
                <p className={styles.subtitle}>
                    v{SERVER_VERSION} · Vercel에 배포된 Model Context Protocol
                    서버입니다.
                </p>
            </header>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>엔드포인트</h2>
                <pre className={styles.code}>
                    <code>POST /api/mcp</code>
                </pre>
                <p className={styles.note}>
                    MCP 클라이언트에서 Streamable HTTP 트랜스포트로 위 경로에
                    연결하세요.
                </p>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>제공 도구</h2>
                <ul className={styles.list}>
                    {TOOLS.map((tool) => (
                        <li key={tool.name} className={styles.listItem}>
                            <code className={styles.toolName}>{tool.name}</code>
                            <span className={styles.toolDescription}>
                                {tool.description}
                            </span>
                            {tool.needsToken && (
                                <span className={styles.tokenTag}>
                                    토큰 필요
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    HuggingFace 토큰 전달 (x-hf-token)
                </h2>
                <p className={styles.note}>
                    <code className={styles.inlineCode}>generate-image</code>{' '}
                    도구는 HuggingFace 토큰이 필요합니다. 클라이언트가{' '}
                    <code className={styles.inlineCode}>x-hf-token</code> 헤더로
                    직접 전달할 수 있고, 헤더가 없으면 서버의{' '}
                    <code className={styles.inlineCode}>HF_TOKEN</code>{' '}
                    환경변수를 사용합니다.
                </p>
                <pre className={styles.code}>
                    <code>{CURSOR_CONFIG}</code>
                </pre>
                <p className={styles.note}>
                    토큰은{' '}
                    <a
                        className={styles.link}
                        href="https://hf.co/settings/tokens"
                        target="_blank"
                        rel="noreferrer"
                    >
                        hf.co/settings/tokens
                    </a>
                    에서 발급받을 수 있습니다.
                </p>
            </section>

            <footer className={styles.footer}>
                <a
                    className={styles.link}
                    href="https://modelcontextprotocol.io/"
                    target="_blank"
                    rel="noreferrer"
                >
                    Model Context Protocol
                </a>
                <span className={styles.separator}>·</span>
                <a
                    className={styles.link}
                    href="https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel"
                    target="_blank"
                    rel="noreferrer"
                >
                    Vercel MCP 문서
                </a>
            </footer>
        </main>
    )
}
