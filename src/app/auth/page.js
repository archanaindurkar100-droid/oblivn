"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleAuth(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        window.location.href = "/";
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.session) {
          window.location.href = "/";
        } else {
          setMessage("Account created! Check your email to confirm your account.");
        }
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080808] px-5 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101010] p-7 shadow-2xl shadow-purple-950/20 sm:p-9">
        <a href="/" className="text-xl font-black tracking-[0.3em]">
          OBLIVN<span className="text-purple-400">.</span>
        </a>

        <p className="mt-10 text-xs tracking-[0.3em] text-purple-300">
          YOUR WORLD. YOUR IDENTITY.
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          {isLogin ? "Welcome back." : "Create your account."}
        </h1>

        <p className="mt-3 text-sm text-zinc-400">
          {isLogin
            ? "Sign in to continue to your world."
            : "Join OBLIVN and create your own space."}
        </p>

        <form onSubmit={handleAuth} className="mt-8 space-y-4">
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Email address
            </label>

            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-purple-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Password
            </label>

            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-purple-400"
            />
          </div>

          {message && (
            <p className="break-words text-sm text-purple-300">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-white py-3.5 font-semibold text-black transition hover:bg-purple-200 disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : isLogin
                ? "Sign in →"
                : "Create account →"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          {isLogin ? "New to OBLIVN?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setMessage("");
            }}
            className="font-semibold text-purple-300 hover:text-purple-200"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </p>

        <a
          href="/"
          className="mt-7 block text-center text-xs text-zinc-500 hover:text-white"
        >
          ← Back to homepage
        </a>
      </div>
    </main>
  );
}