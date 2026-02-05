import { supabase } from './supabase'

// ============================================================================
// EMAIL DOMAIN → COMPANY MAPPING
// ============================================================================
// Rules: matches email domain or keyword in email address
// SLP Alaska emails get 'ALL' access (admin)
const COMPANY_RULES = [
  // SLP Alaska - ADMIN (sees all companies)
  { match: 'slpalaska.com', company: 'ALL', type: 'domain' },
  
  // Client companies
  { match: 'chosencorp.com', company: 'Chosen Construction', type: 'domain' },
  { match: 'magtecalaska.com', company: 'MagTec Alaska', type: 'domain' },
  { match: 'pollard', company: 'Pollard Wireline', type: 'keyword' },
  { match: 'ake-line.com', company: 'AKE-Line', type: 'domain' },
  { match: 'yjosllc.com', company: 'Yellowjacket', type: 'domain' },
  { match: 'gbr', company: 'GBR Equipment', type: 'keyword' },
  
  // Add more client rules here as needed:
  // { match: 'hilcorp.com', company: 'Hilcorp Alaska', type: 'domain' },
  // { match: 'conocophillips.com', company: 'ConocoPhillips', type: 'domain' },
]

// Determine which company a user can access based on their email
export function getCompanyAccess(email) {
  if (!email) return null
  
  const emailLower = email.toLowerCase().trim()
  
  for (const rule of COMPANY_RULES) {
    if (rule.type === 'domain') {
      // Match the domain portion of the email
      if (emailLower.endsWith('@' + rule.match)) {
        return {
          company: rule.company,
          isAdmin: rule.company === 'ALL',
          email: emailLower
        }
      }
    } else if (rule.type === 'keyword') {
      // Match keyword anywhere in the email
      if (emailLower.includes(rule.match)) {
        return {
          company: rule.company,
          isAdmin: false,
          email: emailLower
        }
      }
    }
  }
  
  // No matching rule - deny access
  return null
}

// ============================================================================
// AUTH SESSION HELPERS
// ============================================================================

// Get current logged-in user and their company access
export async function getCurrentUser() {
  const { data: { session }, error } = await supabase.auth.getSession()
  
  if (error || !session?.user) {
    return null
  }
  
  const access = getCompanyAccess(session.user.email)
  
  if (!access) {
    // User is authenticated but not authorized (email not in any rule)
    return {
      user: session.user,
      access: null,
      authorized: false
    }
  }
  
  return {
    user: session.user,
    access,
    authorized: true
  }
}

// Sign out
export async function signOut() {
  await supabase.auth.signOut()
  window.location.href = '/login'
}
