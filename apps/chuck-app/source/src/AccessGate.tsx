import { useState, type ReactNode } from 'react'
import { useAuth, usePodAccess } from 'lemma-sdk/react'
import {
  ArrowRight, Check, Clock3, FileText, Loader2, LockKeyhole,
  LogOut, RefreshCw, Sparkles,
} from 'lucide-react'
import { lemmaClient } from './lemma-client'
import { ChuckPet, ChuckSplash } from './ChuckPet'

function Brand() {
  return (
    <div className="access-brand">
      <span className="brand-dot" />
      <span>Chuck</span>
      <span className="access-brand-sub">your second memory</span>
    </div>
  )
}

function ProductPreview() {
  return (
    <div className="access-preview" aria-hidden="true">
      <div className="preview-note preview-note-one">
        <span className="preview-kind">thought</span>
        <b>The useful bit, kept.</b>
        <p>A stray idea lands now. Chuck sorts it in the background.</p>
        <span className="preview-tag">idea</span>
      </div>
      <div className="preview-note preview-note-two">
        <span className="preview-kind">link</span>
        <b>Links become memory.</b>
        <p>Title, gist, tags, and the original source—ready when you ask.</p>
        <span className="preview-tag">reading</span>
      </div>
      <div className="preview-answer">
        <Sparkles size={14} />
        <span>Ask across everything you kept.</span>
      </div>
    </div>
  )
}

function AccessShell({ children }: { children: ReactNode }) {
  return (
    <main className="access-shell">
      <Brand />
      <div className="access-grid">
        <section className="access-copy">{children}</section>
        <ProductPreview />
      </div>
      <div className="access-foot ui">
        <span><FileText size={13} /> Private by default</span>
        <span><Clock3 size={13} /> Capture now, curate in the background</span>
      </div>
    </main>
  )
}

function LoadingPage() {
  return <ChuckSplash detail="Checking access and putting your notes back where you left them." />
}

function SignedOutPage({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  return (
    <AccessShell>
      <div className="access-kicker ui"><LockKeyhole size={14} /> A private Lemma app</div>
      <h1>Keep the thought.<br />Lose the filing.</h1>
      <p>
        Chuck catches thoughts and links the moment they appear, sorts them quietly,
        then remembers them when you ask.
      </p>
      <div className="access-actions ui">
        <button className="access-primary" onClick={onSignIn}>
          Sign in to Lemma <ArrowRight size={15} />
        </button>
        <button className="access-secondary" onClick={onSignUp}>Create an account</button>
      </div>
      <p className="access-note ui">Signing in returns you to this Chuck pod.</p>
    </AccessShell>
  )
}

function NoAccessPage({
  email, pending, failed, requesting, error, onRequest, onRetry, onSwitchAccount,
}: {
  email: string
  pending: boolean
  failed: boolean
  requesting: boolean
  error: string
  onRequest: () => void
  onRetry: () => void
  onSwitchAccount: () => Promise<void>
}) {
  const [switchingAccount, setSwitchingAccount] = useState(false)
  const [switchError, setSwitchError] = useState('')

  async function switchAccount() {
    setSwitchingAccount(true)
    setSwitchError('')
    try {
      await onSwitchAccount()
    } catch {
      setSwitchError('Could not sign out. Please try again.')
      setSwitchingAccount(false)
    }
  }

  return (
    <AccessShell>
      <ChuckPet
        state={failed ? 'failed' : 'waiting'}
        size={64}
        loop={!failed}
        className="access-state-pet"
      />
      <div className="access-kicker ui"><LockKeyhole size={14} /> Workspace access</div>
      <h1>{failed ? "Couldn't verify pod access." : pending ? 'Request sent.' : 'This Chuck belongs to another workspace.'}</h1>
      <p>
        {failed
          ? 'The membership check did not finish. Your session is still private; retry when the connection is ready.'
          : pending
          ? 'A pod admin can approve your request from Lemma. This page will work as soon as they do.'
          : 'You are signed in to Lemma, but you are not a member of this pod. Its notes stay private until an admin lets you in.'}
      </p>
      {email ? <div className="access-identity ui">Signed in as <b>{email}</b></div> : null}
      <div className="access-actions ui">
        {pending || failed ? (
          <button className="access-secondary" onClick={onRetry}>
            <RefreshCw size={14} /> Check again
          </button>
        ) : (
          <button className="access-primary" onClick={onRequest} disabled={requesting}>
            {requesting ? <><Loader2 size={14} className="spin" /> Sending request…</> : <>Request pod access <ArrowRight size={15} /></>}
          </button>
        )}
        <button
          className="access-secondary"
          onClick={() => { void switchAccount() }}
          disabled={switchingAccount}
        >
          {switchingAccount
            ? <><Loader2 size={14} className="spin" /> Signing out…</>
            : <><LogOut size={14} /> Switch account</>}
        </button>
      </div>
      {pending ? (
        <div className="access-success ui"><Check size={14} /> Your request is waiting for review.</div>
      ) : null}
      {error || switchError ? <div className="access-error ui">{switchError || error}</div> : null}
    </AccessShell>
  )
}

export function AccessGate({ children }: { children: ReactNode }) {
  const auth = useAuth(lemmaClient)
  const access = usePodAccess({
    client: lemmaClient,
    enabled: auth.isAuthenticated,
    autoLoad: true,
  })

  if (auth.isLoading) return <LoadingPage />

  if (!auth.isAuthenticated) {
    return (
      <SignedOutPage
        onSignIn={() => auth.redirectToAuth({ mode: 'login' })}
        onSignUp={() => auth.redirectToAuth({ mode: 'signup' })}
      />
    )
  }

  if (access.status === 'idle' || access.status === 'checking' || access.isLoading) {
    return <LoadingPage />
  }

  if (access.hasAccess) return <>{children}</>

  const error = access.error?.message || ''
  return (
    <NoAccessPage
      email={auth.user?.email || access.user?.email || ''}
      pending={access.status === 'pending'}
      failed={access.status === 'error'}
      requesting={access.isRequestingAccess}
      error={error}
      onRequest={() => { void access.requestAccess().catch(() => undefined) }}
      onRetry={() => { void access.refresh() }}
      onSwitchAccount={() => lemmaClient.auth.redirectToFederatedLogout()}
    />
  )
}
