import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../services/firebase';

export const AuthView: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (!companyName.trim()) {
          setErrorMsg('Informe o nome da sua empresa ou cliente.');
          setLoading(false);
          return;
        }
        const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(userCred.user, {
          displayName: companyName.trim(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err: unknown) {
      console.error('Auth error:', err);
      const code = (err as { code?: string })?.code;
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setErrorMsg('E-mail ou senha inválidos.');
      } else if (code === 'auth/email-already-in-use') {
        setErrorMsg('Este e-mail já está cadastrado.');
      } else if (code === 'auth/weak-password') {
        setErrorMsg('A senha deve ter no mínimo 6 caracteres.');
      } else {
        setErrorMsg('Erro na autenticação. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      console.error('Google sign-in error:', err);
      setErrorMsg('Não foi possível entrar com Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center px-4">
      <div className="w-full max-w-sm mx-auto bg-white border border-zinc-200 rounded-md p-6">
        <div className="flex items-center gap-2 mb-6">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-zinc-900 text-white text-[11px] font-bold tracking-tight">
            BM
          </span>
          <span className="font-semibold text-sm text-zinc-900 tracking-tight">
            Broadcast Message
          </span>
        </div>

        <h1 className="text-base font-semibold text-zinc-900 mb-4">
          {isSignUp ? 'Criar conta' : 'Entrar'}
        </h1>

        {errorMsg && (
          <div className="mb-4 px-3 py-2 rounded bg-red-50 border border-red-200 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
          {isSignUp && (
            <div>
              <label htmlFor="companyName" className="block text-xs font-medium text-zinc-700 mb-1">
                Nome / Empresa
              </label>
              <input
                id="companyName"
                name="companyName"
                type="text"
                placeholder="Ex.: Minha Empresa"
                autoFocus
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-1.5 text-sm bg-white border border-zinc-300 rounded-md focus:outline-none focus:border-zinc-900 disabled:opacity-50"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-zinc-700 mb-1">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="nome@empresa.com"
              autoComplete="email"
              autoFocus={!isSignUp}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-1.5 text-sm bg-white border border-zinc-300 rounded-md focus:outline-none focus:border-zinc-900 disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-zinc-700 mb-1">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-1.5 text-sm bg-white border border-zinc-300 rounded-md focus:outline-none focus:border-zinc-900 disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-3 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-md transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Aguarde...' : isSignUp ? 'Cadastrar' : 'Entrar'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-zinc-200" />
          <span className="text-[11px] text-zinc-400">ou</span>
          <div className="flex-1 h-px bg-zinc-200" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-1.5 px-3 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-700 text-xs font-medium rounded-md transition-colors cursor-pointer disabled:opacity-50"
        >
          Continuar com Google
        </button>

        <div className="mt-5 text-center text-xs text-zinc-500">
          {isSignUp ? 'Já possui conta? ' : 'Não possui conta? '}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg(null);
            }}
            className="text-zinc-900 font-medium hover:underline cursor-pointer"
          >
            {isSignUp ? 'Entrar' : 'Criar conta'}
          </button>
        </div>
      </div>
    </div>
  );
};
