"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const initialLinks = [
  { title: "Instagram", url: "https://instagram.com/" },
  { title: "YouTube", url: "https://youtube.com/" },
  { title: "Spotify", url: "https://spotify.com/" },
];

function createUsername(user) {
  const emailName =
    user.email
      ?.split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 20) || "user";

  return `${emailName}-${user.id.replace(/-/g, "").slice(0, 8)}`;
}

function isValidUrl(value) {
  try {
    const parsed = new URL(value);

    return (
      ["https:", "http:"].includes(parsed.protocol) &&
      parsed.hostname.includes(".")
    );
  } catch {
    return false;
  }
}

export default function Home() {
  const router = useRouter();

  const [name, setName] = useState("Saxx");
  const [bio, setBio] = useState("creating my own world.");
  const [username, setUsername] = useState("");
  const [links, setLinks] = useState(initialLinks);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/auth");
          return;
        }

        if (!active) return;

        setUser(user);
        setUsername(createUsername(user));

        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("username, display_name, bio")
            .eq("user_id", user.id)
            .maybeSingle();

        if (profileError) throw profileError;

        if (profile && active) {
          setUsername(profile.username || createUsername(user));
          setName(profile.display_name || "Saxx");
          setBio(profile.bio || "");
        }

        const { data: savedLinks, error: linksError } =
          await supabase
            .from("links")
            .select("id, title, url, position")
            .eq("user_id", user.id)
            .order("position", { ascending: true });

        if (linksError) throw linksError;

        if (active) {
          if (savedLinks && savedLinks.length > 0) {
            setLinks(
              savedLinks.map((link) => ({
                title: link.title,
                url: link.url,
              }))
            );
          } else {
            setLinks(initialLinks);
          }
        }
      } catch (error) {
        console.error("Profile loading error:", error);

        if (active) {
          setMessage("Could not load your profile. Please refresh.");
          setMessageType("error");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  function showMessage(text, type = "info") {
    setMessage(text);
    setMessageType(type);
  }

  function updateLink(index, field, value) {
    setLinks((current) =>
      current.map((link, i) =>
        i === index ? { ...link, [field]: value } : link
      )
    );
  }

  function addLink() {
    if (links.length >= 6) return;

    setLinks((current) => [
      ...current,
      {
        title: "My Website",
        url: "https://",
      },
    ]);
  }

  function removeLink(index) {
    setLinks((current) =>
      current.filter((_, i) => i !== index)
    );
  }

  async function saveProfile() {
    if (!user) {
      router.replace("/auth");
      return;
    }

    const cleanName = name.trim();
    const cleanBio = bio.trim();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanName) {
      showMessage("Please enter your profile name.", "error");
      return;
    }

    if (!/^[a-z0-9_-]{3,30}$/.test(cleanUsername)) {
      showMessage(
        "Username must be 3–30 characters. Use letters, numbers, _ or -.",
        "error"
      );
      return;
    }

    if (links.some((link) => !link.title.trim())) {
      showMessage("Please enter a name for every link.", "error");
      return;
    }

    if (links.some((link) => !isValidUrl(link.url.trim()))) {
      showMessage("Please enter a valid URL for every link.", "error");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { data: usernameOwner, error: usernameError } =
        await supabase
          .from("profiles")
          .select("user_id")
          .eq("username", cleanUsername)
          .maybeSingle();

      if (usernameError) throw usernameError;

      if (usernameOwner && usernameOwner.user_id !== user.id) {
        showMessage(
          "Username already taken. Please choose another.",
          "error"
        );
        return;
      }

      const { data: existingProfile, error: checkError } =
        await supabase
          .from("profiles")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();

      if (checkError) throw checkError;

      if (existingProfile) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            username: cleanUsername,
            display_name: cleanName,
            bio: cleanBio,
          })
          .eq("user_id", user.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("profiles")
          .insert({
            user_id: user.id,
            username: cleanUsername,
            display_name: cleanName,
            bio: cleanBio,
          });

        if (insertError) throw insertError;
      }

      const { error: deleteError } = await supabase
        .from("links")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      if (links.length > 0) {
        const linksToSave = links.map((link, index) => ({
          user_id: user.id,
          title: link.title.trim(),
          url: link.url.trim(),
          position: index,
        }));

        const { error: insertLinksError } = await supabase
          .from("links")
          .insert(linksToSave);

        if (insertLinksError) throw insertLinksError;
      }

      setUsername(cleanUsername);

      showMessage("Changes saved successfully!", "success");
    } catch (error) {
      console.error("Save error:", error);

      if (error.code === "23505") {
        showMessage(
          "Username already taken. Please choose another.",
          "error"
        );
      } else {
        showMessage(
          error.message || "Could not save your changes.",
          "error"
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      showMessage(error.message, "error");
      return;
    }

    router.replace("/auth");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] text-white">
        <p className="animate-pulse text-xs tracking-[0.3em]">
          OBLIVN
        </p>
      </main>
    );
  }

  const inputClass =
    "w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-white/40";

  const profileUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${username}`
      : `/${username}`;

  return (
    <main className="min-h-screen bg-[#080808] px-5 py-7 text-white sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">

        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <a
            href="/"
            className="text-lg font-bold tracking-[0.28em]"
          >
            OBLIVN
          </a>

          <button
            type="button"
            onClick={logout}
            className="border border-white/15 px-4 py-2 text-xs text-neutral-400 transition hover:border-white hover:text-white"
          >
            Log out
          </button>
        </header>

        <div className="grid gap-12 py-10 md:grid-cols-2 md:gap-16 md:py-16">

          <section>
            <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-500">
              Your identity, online
            </p>

            <h1 className="mt-6 text-5xl font-semibold leading-[1.08] tracking-[-0.05em] sm:text-6xl">
              Everything
              <br />
              starts with
              <br />
              <span className="text-neutral-500">your link.</span>
            </h1>

            <p className="mt-6 max-w-sm text-sm leading-7 text-neutral-400">
              One place for your socials, your work and everything
              you want people to find.
            </p>

            <div className="mt-10 border-t border-white/10 pt-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">
                Signed in as
              </p>

              <p className="mt-2 break-all text-sm text-neutral-300">
                {user?.email}
              </p>
            </div>

            <div className="mt-8 hidden border border-white/10 p-5 md:block">
              <p className="text-xs text-neutral-500">
                YOUR SPACE. YOUR RULES.
              </p>

              <p className="mt-3 text-lg font-medium">
                Less noise. More you.
              </p>
            </div>
          </section>

          <section className="mx-auto w-full max-w-lg">
            <div className="border border-white/10 bg-[#0d0d0d] p-5 sm:p-7">

              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <h2 className="text-xs font-semibold tracking-[0.2em]">
                  PROFILE EDITOR
                </h2>

                <span className="text-[10px] text-neutral-500">
                  EDIT MODE
                </span>
              </div>

              <div className="py-7 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center border border-white/20 bg-white/[0.03] text-3xl font-medium">
                  {name.trim().charAt(0).toUpperCase() || "O"}
                </div>

                <label
                  htmlFor="display-name"
                  className="mt-5 block text-[10px] uppercase tracking-[0.2em] text-neutral-500"
                >
                  Display name
                </label>

                <input
                  id="display-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  placeholder="Your name"
                  className="mt-2 w-full border-b border-white/10 bg-transparent py-2 text-center text-2xl font-semibold outline-none focus:border-white/40"
                />

                <label
                  htmlFor="bio"
                  className="mt-5 block text-left text-[10px] uppercase tracking-[0.2em] text-neutral-500"
                >
                  Bio
                </label>

                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={160}
                  rows={3}
                  placeholder="Write something about yourself..."
                  className="mt-2 w-full resize-none border border-white/10 bg-black p-3 text-sm leading-6 text-neutral-300 outline-none focus:border-white/40"
                />

                <div className="mt-6 text-left">
                  <label
                    htmlFor="username"
                    className="text-[10px] uppercase tracking-[0.2em] text-neutral-500"
                  >
                    Your username
                  </label>

                  <div className="mt-2 flex items-center border border-white/10 bg-black focus-within:border-white/40">
                    <span className="pl-3 text-sm text-neutral-500">
                      @
                    </span>

                    <input
                      id="username"
                      value={username}
                      onChange={(e) =>
                        setUsername(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9_-]/g, "")
                        )
                      }
                      maxLength={30}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="yourname"
                      className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none"
                    />
                  </div>

                  <p className="mt-2 text-xs leading-5 text-neutral-500">
                    Use 3–30 characters: letters, numbers, hyphens or underscores.
                  </p>

                  <div className="mt-4 border border-white/10 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                      Your profile address
                    </p>

                    <p className="mt-2 break-all text-sm text-white">
                      {profileUrl}
                    </p>

                    <a
                      href={`/${encodeURIComponent(username)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-xs text-neutral-400 underline underline-offset-4 transition hover:text-white"
                    >
                      Open saved profile
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h3 className="text-xs font-semibold tracking-[0.2em]">
                  YOUR LINKS
                </h3>

                <span className="text-xs text-neutral-500">
                  {links.length} / 6
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {links.map((link, index) => (
                  <div
                    key={index}
                    className="border border-white/10 p-3 transition hover:border-white/25"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[10px] tracking-[0.15em] text-neutral-500">
                        LINK {String(index + 1).padStart(2, "0")}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeLink(index)}
                        className="text-xs text-neutral-500 transition hover:text-white"
                      >
                        Remove
                      </button>
                    </div>

                    <input
                      value={link.title}
                      onChange={(e) =>
                        updateLink(index, "title", e.target.value)
                      }
                      maxLength={40}
                      aria-label={`Link ${index + 1} name`}
                      placeholder="Link name"
                      className={`${inputClass} mb-2`}
                    />

                    <input
                      value={link.url}
                      onChange={(e) =>
                        updateLink(index, "url", e.target.value)
                      }
                      aria-label={`Link ${index + 1} URL`}
                      placeholder="https://example.com"
                      className={`${inputClass} text-xs text-neutral-300`}
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addLink}
                disabled={links.length >= 6}
                className="mt-4 w-full border border-dashed border-white/20 py-3 text-sm text-neutral-400 transition hover:border-white/50 hover:text-white disabled:opacity-40"
              >
                {links.length >= 6
                  ? "Maximum 6 links reached"
                  : "+ Add link"}
              </button>

              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                className="mt-4 w-full bg-white py-3.5 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-wait disabled:opacity-50"
              >
                {saving ? "Saving changes..." : "Save changes"}
              </button>

              {message && (
                <p
                  aria-live="polite"
                  className={`mt-4 break-words text-center text-xs leading-6 ${
                    messageType === "error"
                      ? "text-red-400"
                      : messageType === "success"
                      ? "text-white"
                      : "text-neutral-400"
                  }`}
                >
                  {message}
                </p>
              )}

              <p className="mt-6 border-t border-white/10 pt-5 text-center text-[10px] tracking-[0.25em] text-neutral-600">
                MADE WITH OBLIVN
              </p>
            </div>
          </section>

        </div>

        <footer className="border-t border-white/10 py-6 text-center text-[10px] tracking-[0.2em] text-neutral-600">
          YOUR SPACE. YOUR IDENTITY.
        </footer>

      </div>
    </main>
  );
}