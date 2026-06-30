'use client';

import { useState } from 'react'
import LandingPage from './components/ui/landing-page'
import Dashboard from './dashboard/page'
import { db } from './lib/db'
//import WalletRoot from './app/WalletRoot'

export default function App() {
  const [stage, setStage] = useState<'LANDING' | 'WALLET_APP'>('LANDING') //now tis would be deternined if th wuser is a guest user or not i mena signed in but cause we are using instantdb guest user this would obviosuly change 

  return (
    <>
      <div className="min-h-screen w-full bg-slate-50 font-sans hidden">
        {stage === 'LANDING' ? (
          <LandingPage onStartApp={() => setStage('WALLET_APP')} />
        ) : (
          <Dashboard onExitToLanding={() => setStage('LANDING')} />
        )}
      </div>

      <db.SignedIn>
        <Dashboard onExitToLanding={() => setStage('LANDING')} />
      </db.SignedIn>
      <db.SignedOut>
        <LandingPage onStartApp={() => setStage('WALLET_APP')} />
      </db.SignedOut>
    </>
  )
}