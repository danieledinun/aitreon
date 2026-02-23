'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Zap, Filter, Clock, MessageSquare, CheckCircle } from 'lucide-react'
import type { SocialReplySettings, ToneOverride, VideoFilter } from '@/lib/types/social'

interface SettingsFormProps {
  creatorId: string
}

export function SettingsForm({ creatorId }: SettingsFormProps) {
  const [settings, setSettings] = useState<Partial<SocialReplySettings>>({
    isEnabled: false,
    maxRepliesPerDay: 50,
    minDelaySeconds: 30,
    maxDelaySeconds: 120,
    toneOverride: 'default',
    maxReplyLength: 300,
    filterKeywords: [],
    requireKeywords: [],
    skipNegative: false,
    videoFilter: 'all',
    recentDays: 7,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [filterInput, setFilterInput] = useState('')
  const [requireInput, setRequireInput] = useState('')

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/social/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings(data)
      } else if (res.status === 403) {
        setError('Auto-replies require a Pro plan or higher.')
      }
    } catch {
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch('/api/social/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (res.ok) {
        const data = await res.json()
        setSettings(data)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save settings')
      }
    } catch {
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const addFilterKeyword = () => {
    if (filterInput.trim() && !settings.filterKeywords?.includes(filterInput.trim())) {
      setSettings({
        ...settings,
        filterKeywords: [...(settings.filterKeywords || []), filterInput.trim()],
      })
      setFilterInput('')
    }
  }

  const removeFilterKeyword = (kw: string) => {
    setSettings({
      ...settings,
      filterKeywords: (settings.filterKeywords || []).filter((k) => k !== kw),
    })
  }

  const addRequireKeyword = () => {
    if (requireInput.trim() && !settings.requireKeywords?.includes(requireInput.trim())) {
      setSettings({
        ...settings,
        requireKeywords: [...(settings.requireKeywords || []), requireInput.trim()],
      })
      setRequireInput('')
    }
  }

  const removeRequireKeyword = (kw: string) => {
    setSettings({
      ...settings,
      requireKeywords: (settings.requireKeywords || []).filter((k) => k !== kw),
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Settings saved successfully.
          </AlertDescription>
        </Alert>
      )}

      {/* Master Toggle */}
      <Card className="bg-gradient-to-br from-tandym-cobalt/5 to-tandym-lilac/5 dark:from-tandym-cobalt/20 dark:to-tandym-lilac/20 border-tandym-cobalt/20 dark:border-tandym-cobalt/30">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6 text-tandym-cobalt" />
              <div>
                <h2 className="text-xl font-semibold font-poppins text-gray-900 dark:text-white">
                  Auto-Reply Status
                </h2>
                <p className="text-sm text-gray-600 dark:text-neutral-400">
                  Enable or disable automatic YouTube comment replies.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium">
                {settings.isEnabled ? 'Enabled' : 'Disabled'}
              </Label>
              <Switch
                checked={settings.isEnabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, isEnabled: checked })
                }
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Reply Behavior */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-tandym-cobalt" />
            Reply Behavior
          </CardTitle>
          <CardDescription>Control how your AI twin replies.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-white/70 dark:bg-neutral-800/70 rounded-lg border border-gray-200 dark:border-neutral-700 p-4 space-y-2">
            <Label>Tone</Label>
            <Select
              value={settings.toneOverride}
              onValueChange={(value: ToneOverride) =>
                setSettings({ ...settings, toneOverride: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default (from AI Settings)</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-white/70 dark:bg-neutral-800/70 rounded-lg border border-gray-200 dark:border-neutral-700 p-4 space-y-2">
            <Label>Max Reply Length: {settings.maxReplyLength} characters</Label>
            <Slider
              value={[settings.maxReplyLength || 300]}
              onValueChange={([val]) =>
                setSettings({ ...settings, maxReplyLength: val })
              }
              min={50}
              max={500}
              step={50}
            />
          </div>

          <div className="bg-white/70 dark:bg-neutral-800/70 rounded-lg border border-gray-200 dark:border-neutral-700 p-4 space-y-2">
            <Label>Max Replies Per Day: {settings.maxRepliesPerDay}</Label>
            <Slider
              value={[settings.maxRepliesPerDay || 50]}
              onValueChange={([val]) =>
                setSettings({ ...settings, maxRepliesPerDay: val })
              }
              min={1}
              max={200}
              step={5}
            />
          </div>
        </CardContent>
      </Card>

      {/* Timing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-tandym-cobalt" />
            Reply Timing
          </CardTitle>
          <CardDescription>Set delays between replies for a natural feel.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/70 dark:bg-neutral-800/70 rounded-lg border border-gray-200 dark:border-neutral-700 p-4 space-y-2">
              <Label>Min Delay (seconds): {settings.minDelaySeconds}</Label>
              <Slider
                value={[settings.minDelaySeconds || 30]}
                onValueChange={([val]) =>
                  setSettings({ ...settings, minDelaySeconds: val })
                }
                min={10}
                max={300}
                step={10}
              />
            </div>
            <div className="bg-white/70 dark:bg-neutral-800/70 rounded-lg border border-gray-200 dark:border-neutral-700 p-4 space-y-2">
              <Label>Max Delay (seconds): {settings.maxDelaySeconds}</Label>
              <Slider
                value={[settings.maxDelaySeconds || 120]}
                onValueChange={([val]) =>
                  setSettings({ ...settings, maxDelaySeconds: val })
                }
                min={30}
                max={600}
                step={10}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-tandym-cobalt" />
            Filters
          </CardTitle>
          <CardDescription>Control which comments get replies.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-white/70 dark:bg-neutral-800/70 rounded-lg border border-gray-200 dark:border-neutral-700 p-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={settings.skipNegative}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, skipNegative: checked })
                }
              />
              <Label>Skip negative / toxic comments</Label>
            </div>
          </div>

          <div className="bg-white/70 dark:bg-neutral-800/70 rounded-lg border border-gray-200 dark:border-neutral-700 p-4 space-y-3">
            <Label>Exclude comments containing these words</Label>
            <div className="flex gap-2">
              <Input
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                placeholder="Add keyword..."
                onKeyDown={(e) => e.key === 'Enter' && addFilterKeyword()}
              />
              <Button variant="outline" onClick={addFilterKeyword}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {(settings.filterKeywords || []).map((kw) => (
                <Badge
                  key={kw}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => removeFilterKeyword(kw)}
                >
                  {kw} &times;
                </Badge>
              ))}
            </div>
          </div>

          <div className="bg-white/70 dark:bg-neutral-800/70 rounded-lg border border-gray-200 dark:border-neutral-700 p-4 space-y-3">
            <Label>Only reply to comments containing these words (leave empty for all)</Label>
            <div className="flex gap-2">
              <Input
                value={requireInput}
                onChange={(e) => setRequireInput(e.target.value)}
                placeholder="Add keyword..."
                onKeyDown={(e) => e.key === 'Enter' && addRequireKeyword()}
              />
              <Button variant="outline" onClick={addRequireKeyword}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {(settings.requireKeywords || []).map((kw) => (
                <Badge
                  key={kw}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => removeRequireKeyword(kw)}
                >
                  {kw} &times;
                </Badge>
              ))}
            </div>
          </div>

          <div className="bg-white/70 dark:bg-neutral-800/70 rounded-lg border border-gray-200 dark:border-neutral-700 p-4 space-y-3">
            <Label>Video Filter</Label>
            <Select
              value={settings.videoFilter}
              onValueChange={(value: VideoFilter) =>
                setSettings({ ...settings, videoFilter: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All videos</SelectItem>
                <SelectItem value="recent">Recent videos only</SelectItem>
                <SelectItem value="selected">Selected videos only</SelectItem>
              </SelectContent>
            </Select>

            {settings.videoFilter === 'recent' && (
              <div className="space-y-2 pt-2">
                <Label>Recent: last {settings.recentDays} days</Label>
                <Slider
                  value={[settings.recentDays || 7]}
                  onValueChange={([val]) =>
                    setSettings({ ...settings, recentDays: val })
                  }
                  min={1}
                  max={30}
                  step={1}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full sm:w-auto bg-gradient-to-r from-tandym-cobalt to-tandym-lilac text-white hover:opacity-90 transition-opacity"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  )
}
