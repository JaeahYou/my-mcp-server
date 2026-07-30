import { InferenceClient } from '@huggingface/inference'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const SERVER_NAME = 'my-mcp-server'
const SERVER_VERSION = '1.0.0'

// Create server instance
const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION
})

const textOutputSchema = (description: string) =>
    z.object({
        content: z
            .array(
                z.object({
                    type: z.literal('text'),
                    text: z.string().describe(description)
                })
            )
            .describe(description)
    })

function toolResult(text: string, isError = false) {
    const content = [{ type: 'text' as const, text }]

    return {
        content,
        isError,
        structuredContent: { content }
    }
}

// outputSchema를 선언하지 않은 도구용 (structuredContent 없이 반환)
function errorResult(text: string) {
    return {
        content: [{ type: 'text' as const, text }],
        isError: true
    }
}

async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })

    let body: unknown
    try {
        body = await res.json()
    } catch {
        throw new Error(`응답을 해석할 수 없습니다 (HTTP ${res.status})`)
    }

    const maybeError = body as { error?: boolean; reason?: string }
    if (!res.ok || maybeError?.error) {
        throw new Error(maybeError?.reason ?? `요청 실패 (HTTP ${res.status})`)
    }

    return body as T
}

// https://open-meteo.com/en/docs - WMO weather interpretation codes
const WMO_CODE_TEXT: Record<number, string> = {
    0: '맑음',
    1: '대체로 맑음',
    2: '구름 조금',
    3: '흐림',
    45: '안개',
    48: '착빙 안개',
    51: '약한 이슬비',
    53: '이슬비',
    55: '강한 이슬비',
    56: '약한 어는 이슬비',
    57: '강한 어는 이슬비',
    61: '약한 비',
    63: '비',
    65: '강한 비',
    66: '약한 어는 비',
    67: '강한 어는 비',
    71: '약한 눈',
    73: '눈',
    75: '강한 눈',
    77: '싸락눈',
    80: '약한 소나기',
    81: '소나기',
    82: '강한 소나기',
    85: '약한 소낙눈',
    86: '강한 소낙눈',
    95: '뇌우',
    96: '우박을 동반한 뇌우',
    99: '강한 우박을 동반한 뇌우'
}

function describeWeatherCode(code: number | undefined): string {
    if (code === undefined) return '정보 없음'
    return WMO_CODE_TEXT[code] ?? `알 수 없음 (WMO ${code})`
}

server.registerTool(
    'greet',
    {
        description: '이름과 언어를 입력하면 인사말을 반환합니다.',
        inputSchema: z.object({
            name: z.string().describe('인사할 사람의 이름'),
            language: z
                .enum(['ko', 'en'])
                .optional()
                .default('en')
                .describe('인사 언어 (기본값: en)')
        }),
        outputSchema: textOutputSchema('인사말')
    },
    async ({ name, language }) => {
        const greeting =
            language === 'ko'
                ? `안녕하세요, ${name}님!`
                : `Hey there, ${name}! 👋 Nice to meet you!`

        return toolResult(greeting)
    }
)

server.registerTool(
    'calculator',
    {
        description: '두 개의 숫자와 연산자를 입력받아 사칙연산 결과를 반환합니다.',
        inputSchema: z.object({
            a: z.number().describe('첫 번째 숫자'),
            b: z.number().describe('두 번째 숫자'),
            operator: z
                .enum(['+', '-', '*', '/'])
                .describe('연산자 (+, -, *, /)')
        }),
        outputSchema: textOutputSchema('연산 결과')
    },
    async ({ a, b, operator }) => {
        let result: number

        switch (operator) {
            case '+':
                result = a + b
                break
            case '-':
                result = a - b
                break
            case '*':
                result = a * b
                break
            case '/':
                if (b === 0) {
                    return toolResult('0으로 나눌 수 없습니다.', true)
                }
                result = a / b
                break
        }

        return toolResult(String(result))
    }
)

const cityToTimezone: Record<string, string> = {
    seoul: 'Asia/Seoul',
    tokyo: 'Asia/Tokyo',
    sapporo: 'Asia/Tokyo',
    삿포로: 'Asia/Tokyo',
    beijing: 'Asia/Shanghai',
    shanghai: 'Asia/Shanghai',
    singapore: 'Asia/Singapore',
    bangkok: 'Asia/Bangkok',
    delhi: 'Asia/Kolkata',
    mumbai: 'Asia/Kolkata',
    dubai: 'Asia/Dubai',
    london: 'Europe/London',
    paris: 'Europe/Paris',
    berlin: 'Europe/Berlin',
    moscow: 'Europe/Moscow',
    'new york': 'America/New_York',
    'newyork': 'America/New_York',
    'los angeles': 'America/Los_Angeles',
    losangeles: 'America/Los_Angeles',
    chicago: 'America/Chicago',
    sydney: 'Australia/Sydney'
}

function resolveTimezone(timezone: string): string {
    const normalized = timezone.trim().toLowerCase()
    return cityToTimezone[normalized] ?? timezone.trim()
}

server.registerTool(
    'get-time',
    {
        description:
            'timezone(또는 도시명)을 입력받아 해당 지역의 현재 시각을 반환합니다.',
        inputSchema: z.object({
            timezone: z
                .string()
                .describe(
                    'IANA timezone(예: Asia/Seoul) 또는 도시명(예: Seoul, Tokyo, London)'
                )
        }),
        outputSchema: textOutputSchema('현재 시각')
    },
    async ({ timezone }) => {
        const resolved = resolveTimezone(timezone)

        try {
            const text = new Intl.DateTimeFormat('ko-KR', {
                timeZone: resolved,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZoneName: 'short'
            }).format(new Date())

            return toolResult(`${resolved}: ${text}`)
        } catch {
            return toolResult(`유효하지 않은 timezone입니다: ${timezone}`, true)
        }
    }
)

const ATTRIBUTION = '출처: Open-Meteo (CC BY 4.0)'

type GeocodeResult = {
    name: string
    latitude: number
    longitude: number
    elevation?: number
    timezone?: string
    country?: string
    admin1?: string
}

server.registerTool(
    'geocode',
    {
        description:
            '도시명(또는 우편번호)을 입력받아 Open-Meteo Geocoding API로 위도/경도 좌표와 타임존을 반환합니다.',
        inputSchema: z.object({
            city: z.string().min(2).describe('도시명 또는 우편번호 (예: 삿포로, Sapporo, 04524)'),
            count: z
                .number()
                .int()
                .min(1)
                .max(10)
                .optional()
                .default(1)
                .describe('반환할 후보 개수 (기본값: 1, 최대 10)')
        }),
        outputSchema: textOutputSchema('위치 좌표 정보')
    },
    async ({ city, count }) => {
        const url =
            'https://geocoding-api.open-meteo.com/v1/search' +
            `?name=${encodeURIComponent(city)}&count=${count}&language=ko&format=json`

        try {
            const data = await fetchJson<{ results?: GeocodeResult[] }>(url)
            const results = data.results ?? []

            if (results.length === 0) {
                return toolResult(
                    `'${city}'에 해당하는 위치를 찾을 수 없습니다.`,
                    true
                )
            }

            const lines = results.map((r) => {
                const place = [r.name, r.admin1, r.country]
                    .filter((part) => part && part.length > 0)
                    .join(', ')

                return (
                    `${place} — 위도 ${r.latitude}, 경도 ${r.longitude}` +
                    (r.timezone ? ` (${r.timezone})` : '')
                )
            })

            return toolResult([...lines, ATTRIBUTION].join('\n'))
        } catch (error) {
            const reason =
                error instanceof Error ? error.message : String(error)
            return toolResult(`위치 검색에 실패했습니다: ${reason}`, true)
        }
    }
)

type ForecastResponse = {
    timezone?: string
    current?: {
        time: string
        temperature_2m: number
        apparent_temperature: number
        relative_humidity_2m: number
        precipitation: number
        weather_code: number
        wind_speed_10m: number
    }
    daily?: {
        time: string[]
        weather_code: number[]
        temperature_2m_max: number[]
        temperature_2m_min: number[]
        precipitation_sum: number[]
        precipitation_probability_max: (number | null)[]
    }
}

server.registerTool(
    'get-weather',
    {
        description:
            '위도/경도 좌표를 입력받아 Open-Meteo Forecast API로 현재 날씨와 일별 예보를 반환합니다.',
        inputSchema: z.object({
            latitude: z.number().min(-90).max(90).describe('위도 (-90 ~ 90)'),
            longitude: z
                .number()
                .min(-180)
                .max(180)
                .describe('경도 (-180 ~ 180)'),
            forecastDays: z
                .number()
                .int()
                .min(1)
                .max(16)
                .optional()
                .default(3)
                .describe('예보 일수 (기본값: 3, 최대 16)'),
            timezone: z
                .string()
                .optional()
                .default('auto')
                .describe('IANA timezone (기본값: auto - 좌표 기준 자동 결정)')
        }),
        outputSchema: textOutputSchema('현재 날씨 및 예보')
    },
    async ({ latitude, longitude, forecastDays, timezone }) => {
        const current = [
            'temperature_2m',
            'apparent_temperature',
            'relative_humidity_2m',
            'precipitation',
            'weather_code',
            'wind_speed_10m'
        ].join(',')

        const daily = [
            'weather_code',
            'temperature_2m_max',
            'temperature_2m_min',
            'precipitation_sum',
            'precipitation_probability_max'
        ].join(',')

        const url =
            'https://api.open-meteo.com/v1/forecast' +
            `?latitude=${latitude}&longitude=${longitude}` +
            `&current=${current}&daily=${daily}` +
            `&timezone=${encodeURIComponent(timezone)}&forecast_days=${forecastDays}`

        try {
            const data = await fetchJson<ForecastResponse>(url)
            const lines: string[] = [
                `좌표 ${latitude}, ${longitude}` +
                    (data.timezone ? ` (${data.timezone})` : '')
            ]

            if (data.current) {
                const c = data.current
                lines.push(
                    '',
                    `[현재 · ${c.time}]`,
                    `날씨: ${describeWeatherCode(c.weather_code)}`,
                    `기온: ${c.temperature_2m}°C (체감 ${c.apparent_temperature}°C)`,
                    `습도: ${c.relative_humidity_2m}%`,
                    `강수량: ${c.precipitation}mm`,
                    `풍속: ${c.wind_speed_10m}km/h`
                )
            }

            if (data.daily) {
                const d = data.daily
                lines.push('', `[${d.time.length}일 예보]`)

                d.time.forEach((date, i) => {
                    const probability = d.precipitation_probability_max[i]
                    lines.push(
                        `${date} · ${describeWeatherCode(d.weather_code[i])} · ` +
                            `${d.temperature_2m_min[i]}~${d.temperature_2m_max[i]}°C · ` +
                            `강수확률 ${probability ?? '-'}% · ` +
                            `강수량 ${d.precipitation_sum[i]}mm`
                    )
                })
            }

            lines.push('', ATTRIBUTION)

            return toolResult(lines.join('\n'))
        } catch (error) {
            const reason =
                error instanceof Error ? error.message : String(error)
            return toolResult(`날씨 조회에 실패했습니다: ${reason}`, true)
        }
    }
)

server.registerTool(
    'generate-image',
    {
        description:
            '프롬프트를 입력받아 HuggingFace Inference API(FLUX.1-schnell)로 이미지를 생성합니다.',
        inputSchema: z.object({
            prompt: z.string().min(1).describe('이미지 생성 프롬프트'),
            num_inference_steps: z
                .number()
                .int()
                .min(1)
                .max(10)
                .optional()
                .default(4)
                .describe('추론 스텝 수 (기본값: 4, 1~10)')
        })
    },
    async ({ prompt, num_inference_steps }) => {
        const token = process.env.HF_TOKEN

        if (!token) {
            return errorResult(
                'HF_TOKEN 환경변수가 설정되지 않았습니다. https://hf.co/settings/tokens 에서 토큰을 발급받아 MCP 서버 설정의 env에 추가하세요.'
            )
        }

        try {
            const client = new InferenceClient(token)

            // outputType을 생략하면 첫 번째 오버로드(Promise<string>)로 추론되므로 명시한다.
            const image = await client.textToImage(
                {
                    provider: 'together',
                    model: 'black-forest-labs/FLUX.1-schnell',
                    inputs: prompt,
                    parameters: { num_inference_steps }
                },
                { outputType: 'blob' }
            )

            const data = Buffer.from(await image.arrayBuffer()).toString(
                'base64'
            )

            return {
                content: [
                    {
                        type: 'image' as const,
                        data,
                        mimeType: 'image/png'
                    }
                ]
            }
        } catch (error) {
            const reason =
                error instanceof Error ? error.message : String(error)
            return errorResult(`이미지 생성에 실패했습니다: ${reason}`)
        }
    }
)

server.registerPrompt(
    'code-review',
    {
        title: 'Code Review',
        description:
            '코드를 입력받아 정해진 규칙에 따라 리뷰하는 프롬프트 템플릿을 반환합니다.',
        argsSchema: {
            code: z.string().describe('리뷰할 코드')
        }
    },
    ({ code }) => ({
        messages: [
            {
                role: 'user' as const,
                content: {
                    type: 'text' as const,
                    text: [
                        '당신은 시니어 소프트웨어 엔지니어입니다. 아래 코드를 다음 규칙에 따라 리뷰하세요.',
                        '',
                        '## 리뷰 규칙',
                        '1. 정확성: 논리 오류, 엣지 케이스, 잘못된 가정',
                        '2. 보안: 입력 검증, 인젝션, 비밀정보 노출, 권한 문제',
                        '3. 가독성/유지보수성: 네이밍, 구조, 중복, 복잡도',
                        '4. 오류 처리: 예외/실패 경로, 사용자 피드백',
                        '5. 성능: 불필요한 연산, 확장성 병목',
                        '6. 테스트 용이성: 순수성, 의존성 분리, 검증 가능성',
                        '',
                        '## 출력 형식',
                        '- 요약 (한 줄)',
                        '- 심각도별 이슈 목록 (Critical / Major / Minor / Nit)',
                        '  - 각 이슈: 위치(가능하면), 문제, 이유, 개선 제안',
                        '- 잘된 점 (있으면)',
                        '- 우선 수정 권장 사항 (최대 3개)',
                        '',
                        '추측은 명시하고, 코드에 근거가 없으면 지적하지 마세요.',
                        '',
                        '## 리뷰 대상 코드',
                        '```',
                        code,
                        '```'
                    ].join('\n')
                }
            }
        ]
    })
)

const SERVER_INFO_URI = 'info://server'

server.registerResource(
    'server-info',
    SERVER_INFO_URI,
    {
        title: 'Server Info',
        description: '이 MCP 서버의 기본 정보(이름, 버전, 제공 도구)를 반환합니다.',
        mimeType: 'text/plain'
    },
    async (uri) => ({
        contents: [
            {
                uri: uri.href,
                mimeType: 'text/plain',
                text: [
                    `# ${SERVER_NAME}`,
                    `version: ${SERVER_VERSION}`,
                    'transport: stdio',
                    '',
                    'tools:',
                    '- greet: 이름/언어로 인사말 생성',
                    '- calculator: 두 숫자 사칙연산',
                    '- get-time: timezone/도시명 현재 시각',
                    '- geocode: 도시명 → 위경도 (Open-Meteo Geocoding)',
                    '- get-weather: 위경도 → 현재 날씨/예보 (Open-Meteo Forecast)',
                    '- generate-image: 프롬프트 → 이미지 생성 (HuggingFace FLUX.1-schnell)',
                    '',
                    'prompts:',
                    '- code-review: 코드 입력 → 규칙 기반 코드 리뷰 프롬프트',
                    '',
                    'resources:',
                    `- server-info (${SERVER_INFO_URI}): 서버 기본 정보`,
                    '',
                    'external APIs:',
                    '- https://geocoding-api.open-meteo.com',
                    '- https://api.open-meteo.com',
                    '- https://router.huggingface.co (HuggingFace Inference Providers, HF_TOKEN 필요)'
                ].join('\n')
            }
        ]
    })
)

server
    .connect(new StdioServerTransport())
    .catch(console.error)
    .then(() => {
        console.log('MCP server started')
    })
