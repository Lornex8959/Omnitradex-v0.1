import Link from 'next/link'
import { AuthForm } from '@/components/auth-form'

export default function SignInPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">OmniTradeX Pro</p>
        <h1>Sign in to your terminal</h1>
        <p className="auth-copy">Access your private research workspace and paper-trading journal.</p>
        <AuthForm mode="sign-in" />
        <p className="auth-switch">New to OmniTradeX? <Link href="/sign-up">Create an account</Link></p>
      </section>
    </main>
  )
}
