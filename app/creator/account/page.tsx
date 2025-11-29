'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  User,
  Mail,
  Shield,
  Bell,
  CreditCard,
  Trash2,
  Upload,
  Save,
  AlertCircle,
  CheckCircle,
  Crown,
  Sparkles,
  LogOut,
  Eye,
  EyeOff,
  Check,
  ArrowRight,
  Loader2,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react'
import { useCreatorPlan } from '@/lib/hooks/use-plan-limits'
import { getPlanConfig, PLANS, type PlanTier } from '@/lib/plans'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'

export default function AccountSettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showUpgrades, setShowUpgrades] = useState(false)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [upgrading, setUpgrading] = useState<PlanTier | null>(null)

  // Profile state
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    displayName: '',
    bio: '',
    profileImage: '',
    username: '',
  })

  // Password state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  // Creator ID and plan
  const [creatorId, setCreatorId] = useState<string | null>(null)
  const { plan, isLoading: planLoading, refetch } = useCreatorPlan(creatorId || undefined)

  const currentPlan = plan ? getPlanConfig(plan.planTier) : null
  const currentTier = (plan?.planTier || 'FREE') as PlanTier

  useEffect(() => {
    fetchAccountData()
  }, [session])

  const fetchAccountData = async () => {
    if (!session?.user?.id) return

    try {
      // Fetch user and creator data
      const [userRes, creatorRes] = await Promise.all([
        fetch('/api/user/profile'),
        fetch('/api/user/creator'),
      ])

      if (userRes.ok) {
        const userData = await userRes.json()
        setProfileData({
          name: userData.name || '',
          email: userData.email || '',
          displayName: userData.displayName || userData.name || '',
          bio: userData.bio || '',
          profileImage: userData.image || '',
          username: userData.username || '',
        })
      }

      if (creatorRes.ok) {
        const creatorData = await creatorRes.json()
        setCreatorId(creatorData.creatorId)
        setProfileData(prev => ({
          ...prev,
          displayName: creatorData.displayName || prev.displayName,
          username: creatorData.username || prev.username,
        }))
      }
    } catch (err) {
      console.error('Failed to fetch account data:', err)
    }
  }

  const handleProfileUpdate = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      })

      if (!response.ok) {
        throw new Error('Failed to update profile')
      }

      setSuccess('Profile updated successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match')
      setLoading(false)
      return
    }

    if (passwordData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to change password')
      }

      setSuccess('Password changed successfully!')
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'profile')

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to upload image')
      }

      const data = await response.json()
      setProfileData(prev => ({ ...prev, profileImage: data.url }))
      setSuccess('Profile image uploaded successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async (targetTier: PlanTier) => {
    if (!creatorId) return

    setUpgrading(targetTier)
    setError('')

    try {
      const response = await fetch(`/api/creators/${creatorId}/subscription/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTier, billingPeriod }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upgrade')
      }

      if (data.requiresPayment && data.checkoutUrl) {
        // Redirect to Stripe checkout
        window.location.href = data.checkoutUrl
      } else {
        // Upgrade successful (e.g., downgrade to FREE)
        await refetch()
        setSuccess('Plan updated successfully!')
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upgrade plan')
    } finally {
      setUpgrading(null)
    }
  }

  const handleCancelSubscription = async () => {
    if (!creatorId || !confirm('Are you sure you want to cancel your subscription?')) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/creators/${creatorId}/subscription/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelImmediately: false }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel')
      }

      await refetch()
      setSuccess(data.message || 'Subscription canceled successfully')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return
    }

    const confirmation = prompt('Type "DELETE" to confirm account deletion:')
    if (confirmation !== 'DELETE') {
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/user/delete', {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete account')
      }

      await signOut({ callbackUrl: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account')
      setLoading(false)
    }
  }

  if (!session) {
    return (
      <div className="container max-w-4xl mx-auto px-6 py-12">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Please sign in to access account settings.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-poppins text-tandym-text-dark mb-2">
          Account Settings
        </h1>
        <p className="text-tandym-text-muted">
          Manage your account preferences and security
        </p>
      </div>

      {/* Success/Error Alerts */}
      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-tandym-cobalt to-tandym-lilac flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                Profile Information
              </CardTitle>
              <CardDescription>
                Update your personal information and profile picture
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Image */}
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24 border-4 border-tandym-cobalt/20">
              <AvatarImage src={profileData.profileImage || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-tandym-cobalt to-tandym-lilac text-white text-2xl font-bold">
                {profileData.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Label htmlFor="profile-image" className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 hover:border-tandym-cobalt transition-colors">
                  <Upload className="w-4 h-4 text-tandym-cobalt" />
                  <span className="text-sm text-tandym-text-dark">Upload new photo</span>
                </div>
                <Input
                  id="profile-image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </Label>
              <p className="text-xs text-tandym-text-muted mt-2">
                JPG, PNG or GIF. Max 5MB.
              </p>
            </div>
          </div>

          <Separator />

          {/* Form Fields */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={profileData.email}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-tandym-text-muted">
                Email cannot be changed
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={profileData.displayName}
                onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                placeholder="How your name appears to others"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-tandym-text-muted">tandym.ai/</span>
                <Input
                  id="username"
                  value={profileData.username}
                  disabled
                  className="bg-gray-50"
                />
              </div>
              <p className="text-xs text-tandym-text-muted">
                Username is set during account creation
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              value={profileData.bio}
              onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tandym-cobalt"
              placeholder="Tell us about yourself..."
            />
            <p className="text-xs text-tandym-text-muted">
              This appears on your public profile
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleProfileUpdate}
              disabled={loading}
              className="bg-gradient-to-r from-tandym-cobalt to-tandym-lilac text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Plan */}
      {!planLoading && plan && currentPlan && (
        <Card className="border-2 border-tandym-cobalt/30 bg-gradient-to-br from-white to-tandym-cobalt/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-tandym-lilac to-tandym-coral flex items-center justify-center">
                    <Crown className="w-4 h-4 text-white" />
                  </div>
                  Subscription Plan
                </CardTitle>
                <CardDescription>
                  Manage your Tandym subscription
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {currentTier !== 'FREE' && plan.subscriptionStatus === 'active' && (
                  <Button variant="outline" onClick={handleCancelSubscription} disabled={loading}>
                    Cancel Plan
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowUpgrades(!showUpgrades)}
                  className="gap-2"
                >
                  {showUpgrades ? (
                    <>
                      Hide Plans <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      View Plans <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-6 rounded-xl bg-gradient-to-br from-tandym-cobalt/10 to-tandym-lilac/10 border border-tandym-cobalt/20">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-bold font-poppins text-tandym-text-dark">
                    {currentPlan.displayName}
                  </h3>
                  {plan.subscriptionStatus === 'trialing' && (
                    <Badge className="bg-tandym-coral text-white">Trial</Badge>
                  )}
                  {plan.subscriptionStatus === 'canceled' && (
                    <Badge variant="destructive">Canceled</Badge>
                  )}
                </div>
                <p className="text-tandym-text-muted mb-4">
                  {plan.planTier === 'FREE'
                    ? 'Free forever'
                    : `$${
                        plan.billingPeriod === 'yearly'
                          ? currentPlan.yearlyPrice
                          : currentPlan.monthlyPrice
                      }/month${plan.billingPeriod === 'yearly' ? ' (billed yearly)' : ''}`}
                </p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-tandym-text-muted mb-1">Videos</div>
                    <div className="font-semibold text-tandym-text-dark">
                      {plan.videoCount} / {currentPlan.limits.maxVideos || '∞'}
                    </div>
                  </div>
                  <div>
                    <div className="text-tandym-text-muted mb-1">Messages</div>
                    <div className="font-semibold text-tandym-text-dark">
                      {plan.monthlyMessageCount} / {currentPlan.limits.maxMessagesPerMonth || '∞'}
                    </div>
                  </div>
                  <div>
                    <div className="text-tandym-text-muted mb-1">Sync</div>
                    <div className="font-semibold text-tandym-text-dark capitalize">
                      {currentPlan.limits.autoSync}
                    </div>
                  </div>
                </div>
              </div>
              <Sparkles className="w-12 h-12 text-tandym-cobalt/30" />
            </div>

            {/* Upgrade Options */}
            {showUpgrades && (
              <div className="space-y-6 pt-4 border-t">
                {/* Billing Period Toggle */}
                <div className="flex justify-center">
                  <div className="flex items-center gap-4">
                    <span
                      className={cn(
                        'text-sm font-medium transition-colors cursor-pointer',
                        billingPeriod === 'monthly' ? 'text-tandym-text-dark' : 'text-tandym-text-muted'
                      )}
                      onClick={() => setBillingPeriod('monthly')}
                    >
                      Monthly
                    </span>
                    <button
                      onClick={() =>
                        setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')
                      }
                      className="relative inline-flex h-8 w-14 items-center rounded-full bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-tandym-cobalt focus:ring-offset-2"
                    >
                      <span
                        className={cn(
                          'inline-block h-6 w-6 transform rounded-full bg-gradient-to-r from-tandym-cobalt to-tandym-lilac transition-transform shadow-md',
                          billingPeriod === 'yearly' ? 'translate-x-7' : 'translate-x-1'
                        )}
                      />
                    </button>
                    <span
                      className={cn(
                        'text-sm font-medium transition-colors cursor-pointer',
                        billingPeriod === 'yearly' ? 'text-tandym-text-dark' : 'text-tandym-text-muted'
                      )}
                      onClick={() => setBillingPeriod('yearly')}
                    >
                      Yearly
                    </span>
                    {billingPeriod === 'yearly' && (
                      <Badge className="bg-tandym-coral text-white">2 Months Free</Badge>
                    )}
                  </div>
                </div>

                {/* Plan Cards */}
                <div className="grid md:grid-cols-4 gap-4">
                  {Object.values(PLANS)
                    .filter(p => p.tier !== 'ENTERPRISE')
                    .map(planConfig => {
                      const isCurrent = currentTier === planConfig.tier
                      const isUpgrade =
                        ['FREE', 'LITE', 'PRO', 'ULTIMATE'].indexOf(planConfig.tier) >
                        ['FREE', 'LITE', 'PRO', 'ULTIMATE'].indexOf(currentTier)

                      return (
                        <Card
                          key={planConfig.tier}
                          className={cn(
                            'relative',
                            isCurrent && 'ring-2 ring-tandym-cobalt',
                            planConfig.popular && 'ring-2 ring-tandym-lilac'
                          )}
                        >
                          {planConfig.popular && (
                            <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-tandym-lilac to-tandym-coral py-1 text-center rounded-t-lg">
                              <span className="text-white text-xs font-bold">POPULAR</span>
                            </div>
                          )}

                          <CardHeader className={cn(planConfig.popular ? 'pt-8' : 'pt-6')}>
                            <CardTitle className="text-lg">{planConfig.displayName}</CardTitle>
                            <div className="pt-3">
                              <span className="text-2xl font-bold">
                                $
                                {billingPeriod === 'monthly'
                                  ? planConfig.monthlyPrice
                                  : planConfig.yearlyPrice}
                              </span>
                              <span className="text-sm text-tandym-text-muted">/mo</span>
                            </div>
                          </CardHeader>

                          <CardContent className="space-y-4">
                            <Button
                              className="w-full"
                              variant={isCurrent ? 'outline' : 'default'}
                              size="sm"
                              disabled={isCurrent || upgrading !== null}
                              onClick={() => handleUpgrade(planConfig.tier)}
                            >
                              {upgrading === planConfig.tier ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Processing...
                                </>
                              ) : isCurrent ? (
                                'Current Plan'
                              ) : isUpgrade ? (
                                <>
                                  Upgrade <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                              ) : (
                                'Downgrade'
                              )}
                            </Button>

                            <div className="space-y-2 text-xs">
                              <div className="flex items-center gap-2">
                                <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                                <span>
                                  {planConfig.limits.maxVideos === null
                                    ? 'Unlimited videos'
                                    : `${planConfig.limits.maxVideos} videos`}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                                <span>
                                  {planConfig.limits.maxMessagesPerMonth === null
                                    ? 'Unlimited messages'
                                    : `${planConfig.limits.maxMessagesPerMonth} msg/mo`}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                                <span className="capitalize">{planConfig.limits.autoSync} sync</span>
                              </div>
                              {planConfig.limits.embedWidget && (
                                <div className="flex items-center gap-2">
                                  <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                                  <span>Embed widget</span>
                                </div>
                              )}
                              {planConfig.limits.removeBranding && (
                                <div className="flex items-center gap-2">
                                  <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                                  <span>No branding</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Security Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            Security
          </CardTitle>
          <CardDescription>
            Change your password and manage security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showPassword ? 'text' : 'password'}
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Enter new password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handlePasswordChange}
              disabled={loading || !passwordData.currentPassword || !passwordData.newPassword}
              variant="outline"
            >
              <Shield className="w-4 h-4 mr-2" />
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Session Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <LogOut className="w-4 h-4 text-white" />
            </div>
            Sessions
          </CardTitle>
          <CardDescription>
            Manage your active sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
            <div>
              <p className="font-medium text-tandym-text-dark">Current Session</p>
              <p className="text-sm text-tandym-text-muted">
                Signed in as {session.user.email}
              </p>
            </div>
            <Button
              onClick={() => signOut({ callbackUrl: '/' })}
              variant="outline"
              size="sm"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 bg-red-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <div className="h-8 w-8 rounded-lg bg-red-500 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-white" />
            </div>
            Danger Zone
          </CardTitle>
          <CardDescription className="text-red-600">
            Irreversible actions that will permanently affect your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-red-300 bg-white">
              <h4 className="font-semibold text-red-700 mb-2">Delete Account</h4>
              <p className="text-sm text-red-600 mb-4">
                Once you delete your account, there is no going back. This will permanently delete
                your profile, videos, analytics, and all associated data.
              </p>
              <Button
                onClick={handleDeleteAccount}
                disabled={loading}
                variant="destructive"
                size="sm"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
