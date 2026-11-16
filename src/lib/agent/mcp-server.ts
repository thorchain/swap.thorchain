import { redirectToCoreMcp } from '@/lib/agent/core-mcp'

// The former swap MCP transport is a migration alias. Runtime tools, protocol
// negotiation, and rate limiting belong to the canonical core deployment.
export const handleMcpPost = redirectToCoreMcp
export const handleMcpGet = redirectToCoreMcp
export const handleMcpOptions = redirectToCoreMcp
