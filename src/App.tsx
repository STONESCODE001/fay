'use client';

import { useState } from 'react'
import LandingPage from './components/ui/landing-page'
import Dashboard from './dashboard/page'
import { db } from './lib/db'
import { Link } from "react-router";

import { FlowsProvider, type LinkComponentType } from "@flows/react";
import * as components from "@flows/react-components";
import * as tourComponents from "@flows/react-components/tour";
import * as surveyComponents from "@flows/react-components/survey";

import "@flows/react-components/index.css";

export const App = () => {

  const [stage, setStage] = useState<'LANDING' | 'WALLET_APP'>('LANDING') //now tis would be deternined if th wuser is a guest user or not i mena signed in but cause we are using instantdb guest user this would obviosuly change 

  return (
    <FlowsProvider
      organizationId="16095936-f4b1-4e65-8df4-8622b0590136"
      userId="YOUR_USER_ID" // Replace this with user id from your app
      environment="production" // Default environment
      components={{ ...components }}
      tourComponents={{ ...tourComponents }}
      surveyComponents={{ ...surveyComponents }}
      // Optional: Use Router Link component for client-side navigation
      LinkComponent={LinkComponent}
    >
      {/* Your app code here */}
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
    </FlowsProvider>
  );
}

const LinkComponent: LinkComponentType = ({ href, children, className, onClick }) => (
  <Link to={href} className={className} onClick={onClick}>
    {children}
  </Link>
);

export default App;