'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Code2, Copy, Check, ExternalLink, Palette, Layout, Upload, X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function EmbedPage() {
  const { data: session } = useSession()
  const [copied, setCopied] = useState(false)
  const [creatorUsername, setCreatorUsername] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

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

  const handleFileUpload = async (file: File, type: 'avatar' | 'logo') => {
    if (type === 'avatar') {
      setUploadingAvatar(true)
    } else {
      setUploadingLogo(true)
    }

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const data = await response.json()

      if (type === 'avatar') {
        setWidgetConfig({ ...widgetConfig, customAvatar: data.url })
      } else {
        setWidgetConfig({ ...widgetConfig, customLogo: data.url })
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload file. Please try again.')
    } finally {
      if (type === 'avatar') {
        setUploadingAvatar(false)
      } else {
        setUploadingLogo(false)
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'logo') => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file, type)
    }
  }

  const removeFile = (type: 'avatar' | 'logo') => {
    if (type === 'avatar') {
      setWidgetConfig({ ...widgetConfig, customAvatar: '' })
    } else {
      setWidgetConfig({ ...widgetConfig, customLogo: '' })
    }
  }

  const previewUrl = creatorUsername
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/embed/${creatorUsername}?${new URLSearchParams({
        theme: widgetConfig.theme,
        color: widgetConfig.primaryColor.replace('#', ''),
        showAvatar: widgetConfig.showAvatar.toString(),
        greeting: widgetConfig.greetingText,
        welcome: widgetConfig.welcomeMessage,
        mode: widgetConfig.widgetMode,
        buttonText: widgetConfig.buttonText,
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
        {/* Live Preview - Left Side */}
        <div className="space-y-6">
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
                <div className="bg-gray-100 dark:bg-neutral-800 rounded-lg p-4 min-h-[600px] relative">
                  <iframe
                    key={previewUrl}
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
        </div>

        {/* Widget Customization - Right Side */}
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
                <Label htmlFor="customAvatar">Custom Avatar</Label>
                {widgetConfig.customAvatar ? (
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                    <img
                      src={widgetConfig.customAvatar}
                      alt="Avatar preview"
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">Avatar uploaded</p>
                      <p className="text-xs text-gray-500">Click remove to change</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile('avatar')}
                      className="shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      id="customAvatar"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileSelect(e, 'avatar')}
                      className="hidden"
                      disabled={uploadingAvatar}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => document.getElementById('customAvatar')?.click()}
                      disabled={uploadingAvatar}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingAvatar ? 'Uploading...' : 'Upload Avatar'}
                    </Button>
                  </div>
                )}
                <p className="text-xs text-gray-500">Leave empty to use your profile image. Max 5MB.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customLogo">Custom Logo</Label>
                {widgetConfig.customLogo ? (
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                    <img
                      src={widgetConfig.customLogo}
                      alt="Logo preview"
                      className="h-8 w-auto max-w-[120px] object-contain"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">Logo uploaded</p>
                      <p className="text-xs text-gray-500">Click remove to change</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile('logo')}
                      className="shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      id="customLogo"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileSelect(e, 'logo')}
                      className="hidden"
                      disabled={uploadingLogo}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => document.getElementById('customLogo')?.click()}
                      disabled={uploadingLogo}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                    </Button>
                  </div>
                )}
                <p className="text-xs text-gray-500">Shown in the widget header. Max 5MB.</p>
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
        </div>
      </div>

      {/* Embed Code Instructions - Full Width Bottom */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="w-5 h-5" />
            Embed Code & Installation
          </CardTitle>
          <CardDescription>
            Choose your preferred integration method and copy the code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="widget" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="widget">Widget (Recommended)</TabsTrigger>
              <TabsTrigger value="iframe">iFrame</TabsTrigger>
            </TabsList>

            <TabsContent value="widget" className="mt-6">
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Installation Steps</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li>Copy the code snippet</li>
                    <li>Paste before closing &lt;/body&gt; tag</li>
                    <li>Widget appears automatically</li>
                  </ol>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <p className="text-xs text-blue-800 dark:text-blue-300">
                      <strong>Pro Tip:</strong> Lightweight (&lt;10KB) and loads asynchronously.
                    </p>
                  </div>
                </div>

                <div className="lg:col-span-2 relative">
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs max-h-[300px]">
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
              </div>
            </TabsContent>

            <TabsContent value="iframe" className="mt-6">
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Installation Steps</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li>Copy the iframe code</li>
                    <li>Paste where you want chat</li>
                    <li>Adjust width and height</li>
                  </ol>
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      <strong>Note:</strong> Precise placement control, but widget offers better UX.
                    </p>
                  </div>
                </div>

                <div className="lg:col-span-2 relative">
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs max-h-[300px]">
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
              </div>
            </TabsContent>
          </Tabs>

          {/* Platform Guides */}
          <div className="mt-6 pt-6 border-t">
            <h4 className="font-semibold text-sm mb-3">Platform-Specific Guides</h4>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
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
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
