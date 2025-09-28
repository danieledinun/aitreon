export default function DebugOAuthPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold mb-6">OAuth Debug Information</h1>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Current Configuration:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><strong>NextAuth URL:</strong> {process.env.NEXTAUTH_URL || 'Not set'}</li>
                <li><strong>Google Client ID:</strong> {process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...` : 'Not set'}</li>
                <li><strong>Expected Redirect URI:</strong> {process.env.NEXTAUTH_URL}/api/auth/callback/google</li>
              </ul>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-800 mb-2">Current Error:</h3>
              <p className="text-red-700 text-sm">
                <code>invalid_client (Unauthorized)</code> - This means Google is rejecting your OAuth credentials.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">Required Google Cloud Console Settings:</h3>
              <ol className="text-blue-700 text-sm space-y-1 list-decimal list-inside">
                <li>Authorized JavaScript origins: <code>http://localhost:3000</code></li>
                <li>Authorized redirect URIs: <code>http://localhost:3000/api/auth/callback/google</code></li>
                <li>YouTube Data API v3 must be enabled</li>
                <li>OAuth consent screen must be configured</li>
                <li>Your email must be added as a test user</li>
              </ol>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-2">Quick Fix:</h3>
              <p className="text-green-700 text-sm">
                If you just created new OAuth credentials, it can take a few minutes for Google to propagate the changes. 
                Try waiting 5-10 minutes and then test the login again.
              </p>
            </div>

            <div className="pt-4">
              <a 
                href="/auth/signin"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Test Login Again
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}