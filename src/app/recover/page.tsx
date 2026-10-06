import Link from 'next/link';
import '@/components/auth.css';
export default function RecoveryPage() {
  return <main className="auth-page"><div className="auth-card">
    <div className="auth-brand">Workspace</div><h1>Get help with access</h1>
    <p className="auth-copy">Contact your workspace operator directly. After checking your identity, they can give you a password reset link that works once and expires after 15 minutes.</p>
    <p className="auth-copy">No email is sent automatically. Never send anyone your password. Resetting it signs out your existing sessions.</p>
    <Link href="/sign-in" className="auth-link">Back to sign in</Link>
  </div></main>;
}
