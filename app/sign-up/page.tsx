import Link from 'next/link'
import { AuthForm } from '@/components/auth-form'

export default function SignUpPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">OmniTradeX Pro</p>
        <h1>Create your workspace</h1>
        <p className="auth-copy">Build a private, evidence-driven trading research process.</p>
        <AuthForm mode="sign-up" />
        <p className="auth-switch">Already have an account? <Link href="/sign-in">Sign in</Link></p>
      </section>
    </main>
  )
}
