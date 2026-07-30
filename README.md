# TypeScript MCP Server — Vercel 배포용 보일러플레이트

Model Context Protocol (MCP) 서버 보일러플레이트입니다. **하나의 도구 정의를 두 개의 트랜스포트가 공유**합니다.

- **Streamable HTTP** — Next.js App Router 라우트(`/api/mcp`), Vercel 배포용
- **stdio** — 로컬에서 `node build/index.js`로 실행하는 기존 방식

## 📁 프로젝트 구조

```
typescript-mcp-server-boilerplate/
├── app/
│   ├── api/mcp/route.ts     # Streamable HTTP 엔드포인트 (mcp-handler)
│   ├── layout.tsx           # 랜딩 페이지 레이아웃
│   ├── page.tsx             # 서버 정보 안내 페이지
│   ├── page.module.css
│   └── globals.css
├── src/
│   ├── mcp/register.ts      # 도구/프롬프트/리소스 정의 (공용)
│   └── index.ts             # stdio 진입점
├── build/                   # stdio 빌드 산출물
├── next.config.ts
├── tsconfig.json            # Next.js용
├── tsconfig.stdio.json      # stdio 빌드용
└── package.json
```

핵심은 [src/mcp/register.ts](src/mcp/register.ts)의 `registerAll(server, options)` 함수입니다. 도구를 추가하려면 이 파일만 수정하면 HTTP와 stdio 양쪽에 동시에 반영됩니다.

## 🛠️ 제공 기능

| 도구 | 설명 | 토큰 필요 |
| --- | --- | --- |
| `greet` | 이름과 언어로 인사말 생성 | |
| `calculator` | 두 숫자의 사칙연산 | |
| `get-time` | timezone 또는 도시명의 현재 시각 | |
| `geocode` | 도시명 → 위경도 (Open-Meteo) | |
| `get-weather` | 위경도 → 현재 날씨와 일별 예보 (Open-Meteo) | |
| `generate-image` | 프롬프트 → 이미지 생성 (FLUX.1-schnell) | ✅ |

이 외에 프롬프트 `code-review`와 리소스 `server-info`(`info://server`)를 제공합니다.

## 🔑 HuggingFace 토큰 전달 방식

`generate-image` 도구는 HuggingFace 토큰이 필요합니다. 토큰은 <https://hf.co/settings/tokens> 에서 발급합니다.

**HTTP 트랜스포트**는 두 가지 경로를 지원하며, 헤더가 환경변수보다 우선합니다.

```
x-hf-token 헤더  →  없으면  →  서버의 HF_TOKEN 환경변수
```

덕분에 서버에 토큰을 두지 않고도 각 클라이언트가 자기 토큰을 쓸 수 있습니다. **stdio 트랜스포트**는 `HF_TOKEN` 환경변수만 사용합니다.

> mcp-handler 1.x가 사용하는 `StreamableHTTPServerTransport`는 도구 콜백에 HTTP 헤더를 전달하지 않습니다. 그래서 [app/api/mcp/route.ts](app/api/mcp/route.ts)에서 요청마다 헤더를 읽어 `registerAll`에 클로저로 주입합니다.

## 🚀 로컬 개발 (HTTP)

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정 (선택)

`x-hf-token` 헤더로 토큰을 전달할 계획이라면 생략해도 됩니다.

```bash
cp .env.example .env.local
# .env.local 에 HF_TOKEN=hf_xxx 입력
```

### 3. 개발 서버 실행

```bash
npm run dev
```

- MCP 엔드포인트: <http://localhost:3000/api/mcp>
- 안내 페이지: <http://localhost:3000>

### 4. MCP Inspector로 테스트

```bash
npx @modelcontextprotocol/inspector
```

1. 브라우저에서 <http://127.0.0.1:6274> 접속
2. 왼쪽 드롭다운에서 **Streamable HTTP** 선택
3. URL에 `http://localhost:3000/api/mcp` 입력
4. **Configuration** 을 펼쳐 터미널에 출력된 Proxy Session Token 붙여넣기
5. **Connect** → **List Tools** 로 도구 확인

`generate-image`를 테스트하려면 Inspector의 커스텀 헤더 설정에 `x-hf-token`을 추가하세요.

## 🖥️ 로컬 개발 (stdio)

```bash
npm run build:stdio
npm run start:stdio
```

## ☁️ Vercel 배포

```bash
npm i -g vercel
vercel
```

또는 GitHub 저장소를 Vercel 프로젝트에 연결하면 push마다 자동 배포됩니다.

배포 후 서버 쪽 폴백 토큰이 필요하면 환경변수를 등록합니다.

```bash
vercel env add HF_TOKEN
```

배포 URL의 엔드포인트는 `https://<your-project>.vercel.app/api/mcp` 입니다.

> [app/api/mcp/route.ts](app/api/mcp/route.ts)는 `runtime = 'nodejs'`로 설정되어 있습니다. `generate-image`가 `Buffer`를 사용하므로 Edge 런타임에서는 동작하지 않습니다.

## 🔧 MCP 클라이언트 연결

### Cursor

`.cursor/mcp.json` (프로젝트) 또는 `~/.cursor/mcp.json` (전역):

```json
{
    "mcpServers": {
        "my-mcp-server": {
            "url": "https://<your-project>.vercel.app/api/mcp",
            "headers": {
                "x-hf-token": "hf_xxx"
            }
        }
    }
}
```

로컬 개발 중이라면 URL만 `http://localhost:3000/api/mcp`로 바꿉니다.

### Streamable HTTP를 지원하지 않는 클라이언트

`mcp-remote`로 stdio ↔ HTTP 브릿지를 사용합니다.

```json
{
    "mcpServers": {
        "my-mcp-server": {
            "command": "npx",
            "args": [
                "-y",
                "mcp-remote",
                "https://<your-project>.vercel.app/api/mcp",
                "--header",
                "x-hf-token:hf_xxx"
            ]
        }
    }
}
```

### 테스트 명령어

- "5 더하기 3은 얼마야?" (`calculator`)
- "삿포로 날씨 알려줘" (`geocode` → `get-weather`)
- "우주를 나는 고양이 이미지 만들어줘" (`generate-image`)

## 🧩 도구 추가하기

[src/mcp/register.ts](src/mcp/register.ts)의 `registerAll` 안에 `server.registerTool`을 추가합니다.

```typescript
server.registerTool(
    'reverse-text',
    {
        description: '입력한 문자열을 뒤집어 반환합니다.',
        inputSchema: z.object({
            text: z.string().describe('뒤집을 문자열')
        }),
        outputSchema: textOutputSchema('뒤집힌 문자열')
    },
    async ({ text }) => toolResult([...text].reverse().join(''))
)
```

외부 비밀정보가 필요한 도구라면 `process.env`를 직접 읽지 말고 `RegisterOptions`에 필드를 추가해 주입받으세요. 그래야 클라이언트별 헤더 전달이 가능합니다.

## 🔧 스크립트

| 스크립트 | 설명 |
| --- | --- |
| `npm run dev` | Next.js 개발 서버 (HTTP 트랜스포트) |
| `npm run build` | Next.js 프로덕션 빌드 |
| `npm start` | Next.js 프로덕션 서버 |
| `npm run build:stdio` | stdio 서버를 `build/`로 컴파일 |
| `npm run start:stdio` | 컴파일된 stdio 서버 실행 |
| `npm run typecheck` | 양쪽 tsconfig 타입 검사 |

## 📦 주요 의존성

- **next**: App Router 라우트 핸들러로 HTTP 엔드포인트 제공
- **mcp-handler**: MCP 서버를 Web 표준 `Request → Response` 핸들러로 변환 (1.0.6 고정 — 상위 버전은 SDK 버전을 정확히 고정하므로 peer 충돌)
- **@modelcontextprotocol/sdk**: MCP 공식 SDK
- **@huggingface/inference**: 이미지 생성
- **zod**: 스키마 검증

## 🔗 참고 자료

- [Vercel MCP 배포 문서](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel)
- [vercel/mcp-handler](https://github.com/vercel/mcp-handler)
- [Model Context Protocol 공식 문서](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Zod 문서](https://zod.dev/)

## 📄 라이선스

MIT
