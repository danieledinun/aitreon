'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Code2, Copy, Check, ExternalLink, Palette, Layout } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function EmbedPage() {
  const { data: session } = useSession()
  const [copied, setCopied] = useState(false)
  const [creatorUsername, setCreatorUsername] = useState('')

  // Widget customization options
  const [widgetConfig, setWidgetConfig] = useState({
    position: 'bottom-right',
    theme: 'light',
    primaryColor: '#6366f1',
    showAvatar: true,
    buttonText: 'Chat with me',
    width: '400',
    height: '600',
    widgetMode: 'full', // 'full' or 'compact'
    greetingText: 'Chat with {name}',
    welcomeMessage: 'Ask me anything! I\'ll do my best to help based on my knowledge.',
    customAvatar: '',
    customLogo: '',
  })

  useEffect(() => {
    // Fetch creator's username
    const fetchCreator = async () => {
      try {
        const res = await fetch('/api/creator/me')
        const data = await res.json()
        if (data.username) {
          setCreatorUsername(data.username)
        }
      } catch (error) {
        console.error('Failed to fetch creator profile:', error)
      }
    }
    fetchCreator()
  }, [])

  const generateEmbedCode = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

    return `<!-- Tandym.ai Chat Widget -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['TandymWidget']=o;w[o] = w[o] || function () { (w[o].q = w[o].q || []).push(arguments) };
    js = d.createElement(s), fjs = d.getElementsByTagName(s)[0];
    js.id = o; js.src = f; js.async = 1; fjs.parentNode.insertBefore(js, fjs);
  }(window, document, 'script', 'tw', '${baseUrl}/widget.js'));
  tw('init', {
    username: '${creatorUsername}',
    position: '${widgetConfig.position}',
    theme: '${widgetConfig.theme}',
    primaryColor: '${widgetConfig.primaryColor}',
    showAvatar: ${widgetConfig.showAvatar},
    buttonText: '${widgetConfig.buttonText}',
    width: '${widgetConfig.width}',
    height: '${widgetConfig.height}'
  });
</script>`
  }

  const generateIframeCode = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const params = new URLSearchParams({
      theme: widgetConfig.theme,
      color: widgetConfig.primaryColor.replace('#', ''),
    }).toString()

    return `<iframe
  src="${baseUrl}/embed/${creatorUsername}?${params}"
  width="${widgetConfig.width}"
  height="${widgetConfig.height}"
  frameborder="0"
  allow="microphone"
  style="border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"
></iframe>`
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const previewUrl = creatorUsername
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/embed/${creatorUsername}?${new URLSearchParams({
        theme: widgetConfig.theme,
        color: widgetConfig.primaryColor.replace('#', ''),
        showAvatar: widgetConfig.showAvatar.toString(),
        greeting: widgetConfig.greetingText,
        welcome: widgetConfig.welcomeMessage,
        ...(widgetConfig.customAvatar && { avatar: widgetConfig.customAvatar }),
        ...(widgetConfig.customLogo && { logo: widgetConfig.customLogo }),
      }).toString()}`
    : ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Embed Widget</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Add your AI twin to any website with our embeddable chat widget
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Widget Customization
              </CardTitle>
              <CardDescription>
                Customize how your chat widget looks and behaves
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="position">Widget Position</Label>
                <Select
                  value={widgetConfig.position}
                  onValueChange={(value) => setWidgetConfig({ ...widgetConfig, position: value })}
                >
                  <SelectTrigger id="position">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom-right">Bottom Right</SelectItem>
                    <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    <SelectItem value="top-right">Top Right</SelectItem>
                    <SelectItem value="top-left">Top Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={widgetConfig.theme}
                  onValueChange={(value) => setWidgetConfig({ ...widgetConfig, theme: value })}
                >
                  <SelectTrigger id="theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="auto">Auto (follows system)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={widgetConfig.primaryColor}
                    onChange={(e) => setWidgetConfig({ ...widgetConfig, primaryColor: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={widgetConfig.primaryColor}
                    onChange={(e) => setWidgetConfig({ ...widgetConfig, primaryColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="widgetMode">Widget Mode</Label>
                <Select
                  value={widgetConfig.widgetMode}
                  onValueChange={(value) => setWidgetConfig({ ...widgetConfig, widgetMode: value })}
                >
                  <SelectTrigger id="widgetMode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Chat Window</SelectItem>
                    <SelectItem value="compact">Compact with Popup Questions</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">Compact mode shows suggested questions above the button</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="buttonText">Button Text</Label>
                <Input
                  id="buttonText"
                  value={widgetConfig.buttonText}
                  onChange={(e) => setWidgetConfig({ ...widgetConfig, buttonText: e.target.value })}
                  placeholder="Chat with me"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="greetingText">Greeting Text</Label>
                <Input
                  id="greetingText"
                  value={widgetConfig.greetingText}
                  onChange={(e) => setWidgetConfig({ ...widgetConfig, greetingText: e.target.value })}
                  placeholder="Chat with {name}"
                />
                <p className="text-xs text-gray-500">Use {'{name}'} as a placeholder for your display name</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="welcomeMessage">Welcome Message</Label>
                <Input
                  id="welcomeMessage"
                  value={widgetConfig.welcomeMessage}
                  onChange={(e) => setWidgetConfig({ ...widgetConfig, welcomeMessage: e.target.value })}
                  placeholder="Ask me anything!"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customAvatar">Custom Avatar URL</Label>
                <Input
                  id="customAvatar"
                  value={widgetConfig.customAvatar}
                  onChange={(e) => setWidgetConfig({ ...widgetConfig, customAvatar: e.target.value })}
                  placeholder="https://example.com/avatar.png"
                />
                <p className="text-xs text-gray-500">Leave empty to use your profile image</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customLogo">Custom Logo URL</Label>
                <Input
                  id="customLogo"
                  value={widgetConfig.customLogo}
                  onChange={(e) => setWidgetConfig({ ...widgetConfig, customLogo: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
                <p className="text-xs text-gray-500">Shown in the widget header</p>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="showAvatar">Show Avatar</Label>
                <Switch
                  id="showAvatar"
                  checked={widgetConfig.showAvatar}
                  onCheckedChange={(checked) => setWidgetConfig({ ...widgetConfig, showAvatar: checked })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="width">Width (px)</Label>
                  <Input
                    id="width"
                    type="number"
                    value={widgetConfig.width}
                    onChange={(e) => setWidgetConfig({ ...widgetConfig, width: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Height (px)</Label>
                  <Input
                    id="height"
                    type="number"
                    value={widgetConfig.height}
                    onChange={(e) => setWidgetConfig({ ...widgetConfig, height: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layout className="w-5 h-5" />
                Live Preview
              </CardTitle>
              <CardDescription>
                See how your widget will look
              </CardDescription>
            </CardHeader>
            <CardContent>
              {creatorUsername ? (
                <div className="bg-gray-100 dark:bg-neutral-800 rounded-lg p-4 min-h-[400px] relative">
                  <iframe
                    src={previewUrl}
                    width={widgetConfig.width}
                    height={widgetConfig.height}
                    className="mx-auto rounded-lg shadow-lg border-0"
                    style={{ maxWidth: '100%' }}
                    allow="microphone"
                    title="Widget Preview"
                  />
                </div>
              ) : (
                <div className="bg-gray-100 dark:bg-neutral-800 rounded-lg p-8 text-center text-gray-500">
                  <p>Loading preview...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Embed Codes */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="w-5 h-5" />
                Embed Code
              </CardTitle>
              <CardDescription>
                Choose your preferred integration method
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="widget" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="widget">Widget (Recommended)</TabsTrigger>
                  <TabsTrigger value="iframe">iFrame</TabsTrigger>
                </TabsList>

                <TabsContent value="widget" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Installation Instructions</Label>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <li>Copy the code snippet below</li>
                      <li>Paste it before the closing {'</body>'} tag in your HTML</li>
                      <li>The widget will appear automatically on your site</li>
                    </ol>
                  </div>

                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                      <code>{generateEmbedCode()}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(generateEmbedCode())}
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Code
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      <strong>Pro Tip:</strong> The widget script is lightweight (&lt;10KB) and loads asynchronously,
                      so it won't slow down your website.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="iframe" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Installation Instructions</Label>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <li>Copy the iframe code below</li>
                      <li>Paste it where you want the chat to appear on your page</li>
                      <li>Adjust width and height as needed</li>
                    </ol>
                  </div>

                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                      <code>{generateIframeCode()}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(generateIframeCode())}
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Code
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      <strong>Note:</strong> The iframe method gives you precise control over placement,
                      but the widget method offers better responsiveness and user experience.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Your Widget</CardTitle>
              <CardDescription>
                Open your widget in a new tab to test it
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => window.open(previewUrl, '_blank')}
                disabled={!creatorUsername}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Widget in New Tab
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Platform Guides</CardTitle>
              <CardDescription>
                Need help installing on your platform?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="justify-start">
                  WordPress
                </Button>
                <Button variant="outline" size="sm" className="justify-start">
                  Wix
                </Button>
                <Button variant="outline" size="sm" className="justify-start">
                  Squarespace
                </Button>
                <Button variant="outline" size="sm" className="justify-start">
                  Webflow
                </Button>
                <Button variant="outline" size="sm" className="justify-start">
                  Shopify
                </Button>
                <Button variant="outline" size="sm" className="justify-start">
                  Custom HTML
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
