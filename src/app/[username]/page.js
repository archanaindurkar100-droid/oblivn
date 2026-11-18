"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PublicProfile() {
const params = useParams();
const username = params.username;

const [profile, setProfile] = useState(null);
const [links, setLinks] = useState([]);
const [loading, setLoading] = useState(true);
const [failed, setFailed] = useState(false);

useEffect(() => {
let active = true;

async function loadProfile() {
  setLoading(true);
  setFailed(false);

  try {
    const { data: profileData, error: profileError } =
      await supabase
        .from("profiles")
        .select("user_id, username, display_name, bio")
        .eq("username", username)
        .maybeSingle();

    if (profileError) throw profileError;

    if (!profileData) {
      if (active) setProfile(null);
      return;
    }

    const { data: linksData, error: linksError } =
      await supabase
        .from("links")
        .select("id, title, url, position")
        .eq("user_id", profileData.user_id)
        .order("position", { ascending: true });

    if (linksError) throw linksError;

    if (active) {
      setProfile(profileData);
      setLinks(linksData || []);
    }
  } catch (error) {
    console.error("Profile loading failed:", error.message);

    if (active) {
      setFailed(true);
    }
  } finally {
    if (active) {
      setLoading(false);
    }
  }
}

if (username) {
  loadProfile();
}

return () => {
  active = false;
};

}, [username]);

if (loading) {
return (
<main className="min-h-screen bg-[#080808] text-white flex items-center justify-center">
<span className="text-xs font-semibold tracking-[0.35em] animate-pulse">
OBLIVN
</span>
</main>
);
}

if (failed || !profile) {
return (
<main className="min-h-screen bg-[#080808] text-white flex flex-col items-center justify-center px-6">
<a
       href="/"
       className="text-lg font-bold tracking-[0.28em]"
     >
OBLIVN
</a>

    <h1 className="mt-16 text-5xl font-semibold tracking-tight">
      {failed ? "Unavailable" : "Not found"}
    </h1>

    <p className="mt-4 text-sm text-neutral-500 text-center">
      {failed
        ? "This profile could not be loaded. Please try again."
        : "This profile doesn't exist."}
    </p>

    <a
      href="/"
      className="mt-8 border border-neutral-700 px-5 py-3 text-sm transition hover:bg-white hover:text-black"
    >
      Back to OBLIVN
    </a>
  </main>
);

}

const displayName = profile.display_name || profile.username;

return (
<main className="min-h-screen bg-[#080808] text-white selection:bg-white selection:text-black">
<div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-6 sm:px-10">

    <header className="flex items-center justify-between border-b border-white/[0.08] py-6">
      <a
        href="/"
        className="text-sm font-bold tracking-[0.28em]"
      >
        OBLIVN
      </a>

      <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">
        Personal space
      </span>
    </header>

    <section className="flex flex-col items-center pb-10 pt-20 text-center sm:pt-24">
      <div className="flex h-[76px] w-[76px] items-center justify-center border border-white/15 bg-white/[0.03] text-2xl font-medium">
        {displayName.charAt(0).toUpperCase()}
      </div>

      <h1 className="mt-7 max-w-full break-words text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
        {displayName}
      </h1>

      <p className="mt-2 text-sm text-neutral-500">
        @{profile.username}
      </p>

      {profile.bio && (
        <p className="mt-5 max-w-sm whitespace-pre-wrap break-words text-sm leading-7 text-neutral-300">
          {profile.bio}
        </p>
      )}
    </section>

    <section className="flex-1 space-y-3">
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex min-h-[58px] items-center justify-between gap-4 border border-white/[0.12] bg-white/[0.025] px-5 py-4 transition-colors duration-200 hover:border-white/50 hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <span className="min-w-0 break-words text-sm font-medium">
            {link.title}
          </span>

          <span className="shrink-0 text-sm text-neutral-500 transition-colors group-hover:text-black">
            ↗
          </span>
        </a>
      ))}

      {links.length === 0 && (
        <p className="border border-dashed border-white/10 py-8 text-center text-sm text-neutral-600">
          No links added yet.
        </p>
      )}
    </section>

    <footer className="mt-20 flex items-center justify-between border-t border-white/[0.08] py-6">
      <span className="text-[10px] uppercase tracking-[0.22em] text-neutral-600">
        Made with OBLIVN
      </span>

      <span className="text-[10px] tracking-wider text-neutral-600">
        © {new Date().getFullYear()}
      </span>
    </footer>

  </div>
</main>

);
}