import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { group_id, last_n = 10 } = await request.json()

    // Use the Graphiti MCP function to get episodes
    const response = await fetch('http://localhost:3001/mcp/call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'get_episodes',
        params: {
          group_id,
          last_n
        }
      })
    })

    if (!response.ok) {
      throw new Error('Failed to fetch episodes from MCP server')
    }

    const mcpResult = await response.json()
    
    return NextResponse.json({ 
      success: true,
      episodes: mcpResult.episodes || []
    })

  } catch (error) {
    console.error('Graphiti episodes API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch episodes' },
      { status: 500 }
    )
  }
}