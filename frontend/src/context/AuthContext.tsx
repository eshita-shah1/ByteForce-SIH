import React, { createContext, useContext, useState } from 'react';
import { User, ViewMode } from '../types';

import { api } from '../services/api';

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  loginModalOpen: boolean;
  redirectTarget: ViewMode | null;
  openLoginModal: (target?: ViewMode) => void;
  closeLoginModal: () => void;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateDisplayName: (name: string) => void;
  currentView: ViewMode;
  setCurrentView: (view: ViewMode) => void;
  language: 'en' | 'hi';
  setLanguage: (lang: 'en' | 'hi') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(false);
  const [redirectTarget, setRedirectTarget] = useState<ViewMode | null>(null);
  const [currentView, setCurrentView] = useState<ViewMode>('landing');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');

  const openLoginModal = (target?: ViewMode) => {
    if (target) {
      setRedirectTarget(target);
    } else {
      setRedirectTarget(null);
    }
    setLoginModalOpen(true);
  };

  const closeLoginModal = () => {
    setLoginModalOpen(false);
  };

  const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !pass) {
      return { success: false, error: 'Please enter both email and password.' };
    }

    // Authenticate against the backend. Invalid credentials and backend/
    // network failures both fail the login - neither ever fabricates a
    // signed-in identity (a wrong password must not grant access, and a
    // downed backend must not be silently indistinguishable from one).
    const result = await api.login(trimmedEmail, pass);
    if (!result.ok) {
      return { success: false, error: result.message };
    }

    setUser(result.user);
    setIsLoggedIn(true);
    setLoginModalOpen(false);

    if (redirectTarget) {
      setCurrentView(redirectTarget);
      setRedirectTarget(null);
    } else {
      setCurrentView('overview');
    }
    return { success: true };
  };

  const logout = () => {
    setIsLoggedIn(false);
    setCurrentView('landing');
  };

  const updateDisplayName = (name: string) => {
    if (!name.trim()) return;
    const parts = name.trim().split(' ');
    const initials = parts.length > 1 
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : name.trim().slice(0, 2).toUpperCase();

    setUser(prev => prev ? { ...prev, name, initials } : null);
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        user,
        loginModalOpen,
        redirectTarget,
        openLoginModal,
        closeLoginModal,
        login,
        logout,
        updateDisplayName,
        currentView,
        setCurrentView,
        language,
        setLanguage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
