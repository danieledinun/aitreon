import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

// Simple admin credentials - TODO: Move to environment variables in production
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: '12345'
}

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'admin-secret-key'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    // Validate credentials
    if (username !== ADMIN_CREDENTIALS.username || password !== ADMIN_CREDENTIALS.password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        username: username,
        role: 'admin',
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    console.log('🔐 Admin login successful for user:', username)

    return NextResponse.json({ 
      token,
      user: { username, role: 'admin' }
    })

  } catch (error) {
    console.error('❌ Admin auth error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}

// Verify admin token
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET) as any

    return NextResponse.json({ 
      valid: true,
      user: { username: decoded.username, role: decoded.role }
    })

  } catch (error) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}