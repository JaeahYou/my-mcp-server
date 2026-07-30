#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { registerAll, SERVER_NAME, SERVER_VERSION } from './mcp/register.js'

const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION
})

registerAll(server, {
    hfToken: process.env.HF_TOKEN,
    transport: 'stdio'
})

try {
    await server.connect(new StdioServerTransport())
    // stdout은 JSON-RPC 채널이므로 로그는 stderr로 보낸다.
    console.error(`${SERVER_NAME} v${SERVER_VERSION} started (stdio)`)
} catch (error) {
    console.error('MCP server failed to start:', error)
    process.exit(1)
}
