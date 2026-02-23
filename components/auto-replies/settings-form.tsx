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
        <Alert>
          <AlertDescription>Settings saved successfully.</AlertDescription>
        </Alert>
      )}

      {/* Master Toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Auto-Reply Status</CardTitle>
          <CardDescription>
            Enable or disable automatic YouTube comment replies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              checked={settings.isEnabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, isEnabled: checked })
              }
            />
            <Label>{settings.isEnabled ? 'Enabled' : 'Disabled'}</Label>
          </div>
        </CardContent>
      </Card>

      {/* Reply Behavior */}
      <Card>
        <CardHeader>
          <CardTitle>Reply Behavior</CardTitle>
          <CardDescription>Control how your AI twin replies.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
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

          <div className="space-y-2">
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

          <div className="space-y-2">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
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
            <div className="space-y-2">
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
          <CardTitle>Filters</CardTitle>
          <CardDescription>Control which comments get replies.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3">
            <Switch
              checked={settings.skipNegative}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, skipNegative: checked })
              }
            />
            <Label>Skip negative / toxic comments</Label>
          </div>

          <div className="space-y-2">
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
            <div className="flex flex-wrap gap-1 mt-2">
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

          <div className="space-y-2">
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
            <div className="flex flex-wrap gap-1 mt-2">
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

          <div className="space-y-2">
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
          </div>

          {settings.videoFilter === 'recent' && (
            <div className="space-y-2">
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
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        {saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  )
}
