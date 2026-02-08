'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getCompanyAccess } from '../../lib/auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login') // 'login', 'register', 'reset'
  const [resetSent, setResetSent] = useState(false)
  const [registerSuccess, setRegisterSuccess] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    })

    if (authError) {
      setError(authError.message === 'Invalid login credentials' 
        ? 'Invalid email or password. Please try again.' 
        : authError.message)
      setLoading(false)
      return
    }

    // Check if user has company access
    const access = getCompanyAccess(data.user.email)
    if (!access) {
      await supabase.auth.signOut()
      setError('Access denied. Your email domain is not authorized. Please contact SLP Alaska at brian@slpalaska.com for access.')
      setLoading(false)
      return
    }

    // Redirect to dashboard
    window.location.href = '/'
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const trimmedEmail = email.trim().toLowerCase()

    // Check if email domain is authorized BEFORE creating account
    const access = getCompanyAccess(trimmedEmail)
    if (!access) {
      setError('Your email domain is not authorized for dashboard access. Please contact SLP Alaska at brian@slpalaska.com to request access for your company.')
      setLoading(false)
      return
    }

    // Validate password
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`
      }
    })

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        setError('An account with this email already exists. Try signing in instead.')
      } else {
        setError(signUpError.message)
      }
      setLoading(false)
      return
    }

    setRegisterSuccess(true)
    setLoading(false)
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/`
    })

    if (resetError) {
      setError(resetError.message)
    } else {
      setResetSent(true)
    }
    setLoading(false)
  }

  const switchMode = (newMode) => {
    setMode(newMode)
    setError('')
    setPassword('')
    setConfirmPassword('')
    setRegisterSuccess(false)
    setResetSent(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
      }}>
        {/* Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/Logo.png" alt="SLP Alaska" style={{ height: '80px', marginBottom: '16px' }} />
          <h1 style={{ 
            color: '#e2e8f0', 
            fontSize: '24px', 
            fontWeight: 700, 
            margin: '0 0 4px 0' 
          }}>
            AnthroSafe™ Field Driven Safety
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
            Real-Time Leading & Lagging Indicators
          </p>
        </div>

        {/* Login Card */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          borderRadius: '12px',
          padding: '32px',
          border: '1px solid #475569'
        }}>
          <h2 style={{ 
            color: '#e2e8f0', 
            fontSize: '18px', 
            fontWeight: 600, 
            margin: '0 0 24px 0',
            textAlign: 'center'
          }}>
            {mode === 'login' && 'Sign In to Your Dashboard'}
            {mode === 'register' && 'Create Your Account'}
            {mode === 'reset' && 'Reset Password'}
          </h2>

          {error && (
            <div style={{
              background: '#7f1d1d',
              border: '1px solid #dc2626',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#fca5a5'
            }}>
              {error}
            </div>
          )}

          {/* Registration Success */}
          {registerSuccess ? (
            <div style={{
              background: '#064e3b',
              border: '1px solid #10b981',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>✅</div>
              <div style={{ color: '#6ee7b7', fontSize: '14px', fontWeight: 600 }}>Account Created!</div>
              <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>
                Check your email ({email}) to confirm your account, then sign in.
              </div>
              <button
                onClick={() => switchMode('login')}
                style={{
                  marginTop: '16px',
                  padding: '8px 20px',
                  background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                Go to Sign In
              </button>
            </div>
          ) : resetSent ? (
            <div style={{
              background: '#064e3b',
              border: '1px solid #10b981',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📧</div>
              <div style={{ color: '#6ee7b7', fontSize: '14px', fontWeight: 600 }}>Check your email</div>
              <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>
                We sent a password reset link to {email}
              </div>
              <button
                onClick={() => switchMode('login')}
                style={{
                  marginTop: '16px',
                  background: 'none',
                  border: 'none',
                  color: '#5eead4',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                ← Back to login
              </button>
            </div>
          ) : (
            <form onSubmit={
              mode === 'login' ? handleLogin : 
              mode === 'register' ? handleRegister : 
              handleResetPassword
            }>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  color: '#94a3b8', 
                  fontSize: '12px', 
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: '#0f172a',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {(mode === 'login' || mode === 'register') && (
                <div style={{ marginBottom: mode === 'register' ? '16px' : '24px' }}>
                  <label style={{ 
                    display: 'block', 
                    color: '#94a3b8', 
                    fontSize: '12px', 
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    minLength={6}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: '#0f172a',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              {mode === 'register' && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ 
                    display: 'block', 
                    color: '#94a3b8', 
                    fontSize: '12px', 
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    minLength={6}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: '#0f172a',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              {mode === 'register' && (
                <div style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginBottom: '20px',
                  fontSize: '11px',
                  color: '#64748b'
                }}>
                  ℹ️ Your company email must be associated with an active SLP Alaska client. If your company is not set up yet, contact <span style={{ color: '#5eead4' }}>brian@slpalaska.com</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: loading 
                    ? '#475569' 
                    : 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.2s'
                }}
              >
                {loading ? 'Please wait...' : 
                 mode === 'login' ? 'Sign In' : 
                 mode === 'register' ? 'Create Account' : 
                 'Send Reset Link'}
              </button>

              {/* Mode switching links */}
              <div style={{ textAlign: 'center', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {mode === 'login' && (
                  <>
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#5eead4',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      Don&apos;t have an account? <strong>Create one</strong>
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Forgot your password?
                    </button>
                  </>
                )}
                {mode === 'register' && (
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#5eead4',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    Already have an account? <strong>Sign in</strong>
                  </button>
                )}
                {mode === 'reset' && (
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#5eead4',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    ← Back to login
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div style={{ 
          textAlign: 'center', 
          marginTop: '24px', 
          color: '#475569', 
          fontSize: '11px' 
        }}>
          AnthroSafe™ Field Driven Safety | © 2026 SLP Alaska, LLC
        </div>
      </div>
    </div>
  )
}
