import React, { useState, useEffect } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  CircularProgress,
  Box,
} from '@mui/material';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from './services/firebase';
import { startBroadcastWorker, stopBroadcastWorker } from './services/broadcastWorker';
import { Navbar, ActiveTab } from './components/Navbar';
import { AuthView } from './components/AuthView';
import { ConnectionsView } from './components/ConnectionsView';
import { ContactsView } from './components/ContactsView';
import { BroadcastView } from './components/BroadcastView';
import { MessagesFeed } from './components/MessagesFeed';
import { TenantUser } from './types';

const theme = createTheme({
  palette: {
    primary: {
      main: '#18181B',
      light: '#3F3F46',
      dark: '#09090B',
    },
    secondary: {
      main: '#52525B',
    },
    background: {
      default: '#FAFAFA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#18181B',
      secondary: '#71717A',
    },
    divider: '#E4E4E7',
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  },
  shape: {
    borderRadius: 6,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          boxShadow: 'none',
          fontWeight: 500,
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          '& fieldset': {
            borderColor: '#E4E4E7',
          },
          '&:hover fieldset': {
            borderColor: '#A1A1AA',
          },
        },
      },
    },
  },
});

export default function App() {
  const [currentUser, setCurrentUser] = useState<TenantUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('connections');
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);

  // Monitor auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (firebaseUser) {
        setCurrentUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
        });
        // Start background worker for scheduled messages
        startBroadcastWorker(5000);
      } else {
        setCurrentUser(null);
        stopBroadcastWorker();
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribe();
      stopBroadcastWorker();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      stopBroadcastWorker();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleSelectConnectionForContacts = (connId: string) => {
    setActiveConnectionId(connId);
    setActiveTab('contacts');
  };

  const handleSelectConnectionForBroadcast = (connId: string) => {
    setActiveConnectionId(connId);
    setActiveTab('broadcast');
  };

  if (authLoading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FAFAFA',
          }}
        >
          <CircularProgress size={24} sx={{ color: '#18181B' }} />
        </Box>
      </ThemeProvider>
    );
  }

  if (!currentUser) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthView />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col text-zinc-900 font-sans">
        <Navbar
          user={currentUser}
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          onLogout={handleLogout}
        />

        <main className="flex-1 pb-12">
          {activeTab === 'connections' && (
            <ConnectionsView
              onSelectConnectionForContacts={handleSelectConnectionForContacts}
              onSelectConnectionForBroadcast={handleSelectConnectionForBroadcast}
            />
          )}

          {activeTab === 'contacts' && (
            <ContactsView
              initialConnectionId={activeConnectionId}
              onNavigateToConnections={() => setActiveTab('connections')}
            />
          )}

          {activeTab === 'broadcast' && (
            <BroadcastView
              initialConnectionId={activeConnectionId}
              onNavigateToConnections={() => setActiveTab('connections')}
              onNavigateToContacts={(connId) => {
                setActiveConnectionId(connId);
                setActiveTab('contacts');
              }}
              onBroadcastCreated={() => {
                setActiveTab('messages');
              }}
            />
          )}

          {activeTab === 'messages' && (
            <MessagesFeed onNavigateToBroadcast={() => setActiveTab('broadcast')} />
          )}
        </main>
      </div>
    </ThemeProvider>
  );
}
