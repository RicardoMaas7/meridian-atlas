// Smoke check for the MCP server: spawns dist-mcp/server.mjs over stdio,
// surveys this repository, and reads one symbol.
// Run: npm run build:mcp && node scripts/check-mcp.mjs
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

const client = new Client({ name: 'check-mcp', version: '0.0.0' })
await client.connect(
  new StdioClientTransport({ command: 'node', args: [join(root, 'dist-mcp/server.mjs')] }),
)

const { tools } = await client.listTools()
console.log(`tools: ${tools.map((t) => t.name).join(', ')}\n`)

const survey = await client.callTool({ name: 'survey', arguments: { directory: root } })
console.log(survey.content[0].text)
console.log('\n――――――――\n')

const symbol = await client.callTool({
  name: 'symbol',
  arguments: { directory: root, name: 'buildChart' },
})
console.log(symbol.content[0].text)

await client.close()
const failed = survey.isError || symbol.isError
process.exit(failed ? 1 : 0)
