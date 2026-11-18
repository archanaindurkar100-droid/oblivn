"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const MAX_LINKS = 6;

const THEMES = {
  midnight: {
    label: "Midnight",
    color: "#a3a3a3",
  },
  crimson: {
    label: "Crimson",
    color: "#ff4655",
  },
  violet: {
    label: "Violet",
    color: "#a78bfa",
  },
  emerald: {
    label: "Emerald",
    color: "#34d399",
  },
};

const BACKGROUNDS = [
  { value: "glow", label: "Atmospheric Glow" },
  { value: "gradient", label: "Dark Gradient" },
  { value: "solid", label: "Pure Black" },
];

export default function Home() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [links, setLinks] = useState([]);

  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  const [theme, setTheme] = useState("midnight");
  const [accentColor, setAccentColor] = useState("#a3a3a3");
  const [backgroundStyle, setBackgroundStyle] = useState("glow");

  const [totalViews, setTotalViews] = useState(0);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  function showMessage(text, type = "info") {
    setMessage(text);
    setMessageType(type);
  }

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;
        if (!mounted) return;

        setSession(data.session);

        if (data.session) {
          await loadProfile(
            data.session.user.id,
            data.session.user.email
          );
        }
      } catch (error) {
        if (mounted) {
          showMessage(
            error.message || "Unable to initialize OBLIVN.",
            "error"
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;

      setSession(newSession);

      if (!newSession) {
        setUsername("");
        setDisplayName("");
        setBio("");
        setLinks([]);
        setAvatarUrl("");
        setAvatarPreview("");
        setAvatarFile(null);
        setTotalViews(0);

        setTheme("midnight");
        setAccentColor("#a3a3a3");
        setBackgroundStyle("glow");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadProfile(userId, userEmail) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      showMessage(profileError.message, "error");
      return;
    }

    if (profile) {
      setUsername(profile.username || "");
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");

      setAvatarUrl(profile.avatar_url || "");
      setAvatarPreview(profile.avatar_url || "");
      setAvatarFile(null);

      const savedTheme = Object.hasOwn(
        THEMES,
        profile.theme
      )
        ? profile.theme
        : "midnight";

      setTheme(savedTheme);

      const savedAccent = /^#[0-9a-fA-F]{6}$/.test(
        profile.accent_color || ""
      )
        ? profile.accent_color
        : THEMES[savedTheme].color;

      setAccentColor(savedAccent);

      const savedBackground = BACKGROUNDS.some(
        (item) => item.value === profile.background_style
      )
        ? profile.background_style
        : "glow";

      setBackgroundStyle(savedBackground);

      if (profile.username) {
        setAnalyticsLoading(true);

        try {
          const { data: views, error: viewsError } =
            await supabase.rpc("get_profile_views", {
              profile_username: profile.username,
            });

          if (viewsError) {
            console.error(
              "Analytics error:",
              viewsError.message
            );
          } else {
            setTotalViews(Number(views) || 0);
          }
        } catch (error) {
          console.error(
            "Could not load profile views:",
            error
          );
        } finally {
          setAnalyticsLoading(false);
        }
      } else {
        setTotalViews(0);
      }
    } else {
      const suggestedUsername =
        userEmail
          ?.split("@")[0]
          ?.toLowerCase()
          .replace(/[^a-z0-9_]/g, "") || "creator";

      setUsername(suggestedUsername);
      setDisplayName("");
      setBio("");
      setAvatarUrl("");
      setAvatarPreview("");
      setAvatarFile(null);
      setTotalViews(0);

      setTheme("midnight");
      setAccentColor("#a3a3a3");
      setBackgroundStyle("glow");
    }

    const { data: savedLinks, error: linksError } =
      await supabase
        .from("links")
        .select("*")
        .eq("user_id", userId)
        .order("position", { ascending: true });

    if (linksError) {
      showMessage(linksError.message, "error");
      return;
    }

    setLinks(
      (savedLinks || []).map((link) => ({
        title: link.title || "",
        url: link.url || "",
      }))
    );
  }

  async function handleAuth(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        if (data.session) {
          setSession(data.session);

          await loadProfile(
            data.session.user.id,
            data.session.user.email
          );

          showMessage(
            "Account created successfully!",
            "success"
          );
        } else {
          showMessage(
            "Account created! Confirm your email before logging in.",
            "success"
          );
        }
      } else {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (error) throw error;

        setSession(data.session);

        await loadProfile(
          data.user.id,
          data.user.email
        );

        showMessage("Welcome back!", "success");
      }
    } catch (error) {
      showMessage(
        error.message || "Something went wrong.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);

    const { error } = await supabase.auth.signOut();

    setBusy(false);

    if (error) {
      showMessage(error.message, "error");
      return;
    }

    setSession(null);
    showMessage("Logged out successfully.", "success");
  }

  function handleAvatarChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(file.type)) {
      showMessage(
        "Choose a JPG, PNG, WEBP, or GIF image.",
        "error"
      );
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showMessage(
        "Image must be smaller than 5 MB.",
        "error"
      );
      event.target.value = "";
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));

    showMessage(
      "Picture selected. Save changes to upload it.",
      "info"
    );
  }

  async function uploadAvatar() {
    if (!avatarFile || !session?.user) {
      return avatarUrl;
    }

    const extensions = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };

    const extension = extensions[avatarFile.type];

    const filePath =
      `${session.user.id}/${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage
      .from("avatars")
      .upload(filePath, avatarFile, {
        contentType: avatarFile.type,
        upsert: false,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  function updateLink(index, field, value) {
    setLinks((current) =>
      current.map((link, i) =>
        i === index
          ? { ...link, [field]: value }
          : link
      )
    );
  }

  function addLink() {
    if (links.length >= MAX_LINKS) {
      showMessage(
        "You can add a maximum of 6 links.",
        "error"
      );
      return;
    }

    setLinks((current) => [
      ...current,
      { title: "", url: "" },
    ]);
  }

  function removeLink(index) {
    setLinks((current) =>
      current.filter((_, i) => i !== index)
    );
  }

  function normalizeUrl(value) {
    const trimmed = value.trim();

    if (!trimmed) return "";

    return /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
  }

  function validateLinks() {
    for (const link of links) {
      if (!link.title.trim() && !link.url.trim()) {
        continue;
      }

      if (!link.title.trim() || !link.url.trim()) {
        showMessage(
          "Complete both the title and URL for every link, or remove the empty link.",
          "error"
        );

        return false;
      }

      try {
        const parsed = new URL(normalizeUrl(link.url));

        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new Error();
        }
      } catch {
        showMessage(
          `Please enter a valid URL for "${link.title}".`,
          "error"
        );

        return false;
      }
    }

    return true;
  }

  function selectTheme(themeName) {
    const selected = THEMES[themeName];

    if (!selected) return;

    setTheme(themeName);
    setAccentColor(selected.color);
  }

  async function saveEverything(event) {
    event.preventDefault();

    if (!session?.user) {
      showMessage("Please log in first.", "error");
      return;
    }

    const cleanUsername = username.trim().toLowerCase();

    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      showMessage(
        "Username must be 3–30 characters and contain only lowercase letters, numbers, and underscores.",
        "error"
      );

      return;
    }

    if (!/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
      showMessage(
        "Please choose a valid accent color.",
        "error"
      );
      return;
    }

    if (!Object.hasOwn(THEMES, theme)) {
      showMessage("Please choose a valid theme.", "error");
      return;
    }

    if (
      !BACKGROUNDS.some(
        (item) => item.value === backgroundStyle
      )
    ) {
      showMessage(
        "Please choose a valid background.",
        "error"
      );
      return;
    }

    if (!validateLinks()) return;

    setBusy(true);
    setMessage("");

    try {
      const uploadedAvatarUrl = await uploadAvatar();

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: session.user.id,
            username: cleanUsername,
            display_name: displayName.trim(),
            bio: bio.trim(),
            avatar_url: uploadedAvatarUrl,
            theme,
            accent_color: accentColor,
            background_style: backgroundStyle,
          },
          { onConflict: "user_id" }
        );

      if (profileError) throw profileError;

      const { error: deleteError } = await supabase
        .from("links")
        .delete()
        .eq("user_id", session.user.id);

      if (deleteError) throw deleteError;

      const cleanLinks = links
        .filter(
          (link) =>
            link.title.trim() && link.url.trim()
        )
        .map((link, index) => ({
          user_id: session.user.id,
          title: link.title.trim(),
          url: normalizeUrl(link.url),
          position: index,
        }));

      if (cleanLinks.length > 0) {
        const { error: insertError } = await supabase
          .from("links")
          .insert(cleanLinks);

        if (insertError) throw insertError;
      }

      setUsername(cleanUsername);
      setAvatarUrl(uploadedAvatarUrl || "");
      setAvatarFile(null);

      showMessage(
        "Your profile and customization have been saved!",
        "success"
      );
    } catch (error) {
      showMessage(
        error.message ||
          "Could not save your changes. Please try again.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyProfileLink() {
    if (!username.trim()) {
      showMessage(
        "Choose a username before copying your profile link.",
        "error"
      );
      return;
    }

    const url =
      `${window.location.origin}/${username.trim()}`;

    try {
      await navigator.clipboard.writeText(url);

      showMessage(
        "Profile link copied!",
        "success"
      );
    } catch {
      showMessage(
        "Unable to copy the link. Please copy it manually.",
        "error"
      );
    }
  }

  const profileUrl =
    typeof window !== "undefined" && username.trim()
      ? `${window.location.origin}/${username.trim()}`
      : "";

  const dashboardStyle = {
    "--accent": accentColor,
    "--accent-soft": `${accentColor}18`,
    "--accent-border": `${accentColor}65`,
  };

  if (loading) {
    return (
      <main className="loading-screen">
        <div className="loader-orbit">
          <div className="loader-core">O.</div>
        </div>

        <h1>
          OBLIVN<span>.</span>
        </h1>

        <p>PREPARING YOUR SPACE</p>

        <div className="loader-track">
          <div />
        </div>

        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #080808;
            color: white;
            font-family: Arial, sans-serif;
          }

          .loader-orbit {
            width: 78px;
            height: 78px;
            display: grid;
            place-items: center;
            border: 1px solid #444;
            animation: orbit 3s linear infinite;
          }

          .loader-core {
            font-size: 30px;
            font-weight: 900;
            letter-spacing: -4px;
          }

          h1 {
            margin: 27px 0 9px;
            font-size: 15px;
            letter-spacing: 5px;
          }

          h1 span {
            color: #777;
          }

          p {
            color: #666;
            font: 9px "Courier New", monospace;
            letter-spacing: 3px;
          }

          .loader-track {
            width: 100px;
            height: 1px;
            margin-top: 15px;
            background: #222;
            overflow: hidden;
          }

          .loader-track div {
            width: 45%;
            height: 100%;
            background: white;
            animation: loading 1.2s ease-in-out infinite alternate;
          }

          @keyframes orbit {
            to {
              transform: rotate(360deg);
            }
          }

          @keyframes loading {
            from {
              transform: translateX(-100%);
            }
            to {
              transform: translateX(220%);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            * {
              animation: none !important;
            }
          }
        `}</style>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="auth-page">
        <div className="auth-glow" />

        <header className="auth-nav">
          <a href="/" className="brand">
            OBLIVN<span>.</span>
          </a>

          <span className="nav-caption">
            YOUR SPACE. YOUR RULES.
          </span>
        </header>

        <section className="auth-content">
          <div className="eyebrow">
            <span className="status-dot" />
            THE PERSONAL LINK SPACE
          </div>

          <h1>
            Everything you are.
            <br />
            <span>One link.</span>
          </h1>

          <p className="description">
            A minimal home for your digital identity.
            <br />
            No noise. Just you.
          </p>

          <form className="auth-card" onSubmit={handleAuth}>
            <div className="card-heading">
              <div>
                <h2>
                  {isSignup
                    ? "Create account"
                    : "Welcome back"}
                </h2>

                <p>
                  {isSignup
                    ? "Start building your personal space."
                    : "Sign in to manage your space."}
                </p>
              </div>

              <span className="card-symbol">O.</span>
            </div>

            <label htmlFor="email">
              EMAIL ADDRESS
            </label>

            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
            />

            <label htmlFor="password">
              PASSWORD
            </label>

            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              autoComplete={
                isSignup
                  ? "new-password"
                  : "current-password"
              }
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              minLength={6}
              required
            />

            {message && (
              <div className={`message ${messageType}`}>
                {message}
              </div>
            )}

            <button
              className="primary-button"
              type="submit"
              disabled={busy}
            >
              {busy
                ? "PLEASE WAIT..."
                : isSignup
                  ? "CREATE ACCOUNT ↗"
                  : "SIGN IN ↗"}
            </button>

            <div className="auth-switch">
              <span>
                {isSignup
                  ? "Already have an account?"
                  : "New to OBLIVN?"}
              </span>

              <button
                type="button"
                onClick={() => {
                  setIsSignup(!isSignup);
                  setMessage("");
                }}
              >
                {isSignup ? "Sign in" : "Create account"}
              </button>
            </div>
          </form>

          <p className="footnote">
            BUILT FOR THE ONES WHO KEEP IT DIFFERENT.
          </p>
        </section>

        <footer className="auth-footer">
          <span>© 2026 OBLIVN</span>
          <span>MADE FOR YOUR WORLD.</span>
        </footer>

        <style jsx>{`
          * {
            box-sizing: border-box;
          }

          .auth-page {
            min-height: 100vh;
            position: relative;
            isolation: isolate;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background: #080808;
            color: white;
            font-family: Arial, sans-serif;
          }

          .auth-glow {
            position: absolute;
            z-index: -1;
            top: 15%;
            left: -250px;
            width: 400px;
            height: 400px;
            border-radius: 50%;
            background: #fff;
            opacity: 0.04;
            filter: blur(130px);
          }

          .auth-nav {
            height: 78px;
            padding: 0 7%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid #222;
            animation: enter 0.7s ease both;
          }

          .brand {
            color: white;
            font-size: 23px;
            font-weight: 900;
            letter-spacing: -1.5px;
            text-decoration: none;
          }

          .brand span {
            color: #777;
          }

          .nav-caption,
          .footnote,
          .auth-footer {
            color: #707070;
            font-size: 9px;
            letter-spacing: 1.5px;
          }

          .auth-content {
            width: min(100% - 36px, 440px);
            margin: 75px auto 60px;
            flex: 1;
            animation: enter 0.8s 0.1s ease both;
          }

          .eyebrow {
            display: flex;
            align-items: center;
            gap: 9px;
            color: #999;
            font-size: 10px;
            letter-spacing: 2px;
          }

          .status-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: white;
          }

          h1 {
            margin: 27px 0 15px;
            font-size: clamp(38px, 8vw, 55px);
            line-height: 1.05;
            letter-spacing: -3px;
          }

          h1 span {
            color: #747474;
          }

          .description {
            margin-bottom: 34px;
            color: #858585;
            font-size: 13px;
            line-height: 1.8;
          }

          .auth-card {
            padding: 28px;
            border: 1px solid #292929;
            border-radius: 10px;
            background: linear-gradient(145deg, #131313, #0b0b0b);
            box-shadow: 0 20px 80px #00000045;
            transition: border-color 0.3s;
          }

          .auth-card:hover {
            border-color: #444;
          }

          .card-heading {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 28px;
          }

          .card-heading h2 {
            margin: 0 0 7px;
            font-size: 19px;
          }

          .card-heading p {
            margin: 0;
            color: #888;
            font-size: 12px;
          }

          .card-symbol {
            font-size: 27px;
            font-weight: 900;
          }

          label {
            display: block;
            margin: 20px 0 9px;
            color: #aaa;
            font-size: 10px;
            letter-spacing: 1.5px;
          }

          input {
            width: 100%;
            min-height: 47px;
            padding: 0 13px;
            border: 1px solid #303030;
            border-radius: 5px;
            outline: none;
            background: #080808;
            color: white;
            font-size: 13px;
            transition: border-color 0.25s;
          }

          input:focus {
            border-color: #999;
          }

          input::placeholder {
            color: #575757;
          }

          button {
            font: inherit;
          }

          .primary-button {
            width: 100%;
            min-height: 48px;
            margin-top: 24px;
            border: 1px solid white;
            border-radius: 5px;
            background: white;
            color: black;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 1.3px;
            cursor: pointer;
            transition: transform 0.25s, background 0.25s;
          }

          .primary-button:hover:not(:disabled) {
            background: #ddd;
            transform: translateY(-2px);
          }

          button:disabled {
            opacity: 0.55;
            cursor: wait;
          }

          .auth-switch {
            display: flex;
            justify-content: center;
            gap: 6px;
            flex-wrap: wrap;
            margin-top: 22px;
            color: #858585;
            font-size: 11px;
          }

          .auth-switch button {
            border: none;
            background: transparent;
            color: white;
            font-size: 11px;
            text-decoration: underline;
            cursor: pointer;
          }

          .message {
            padding: 12px;
            margin-top: 18px;
            border-radius: 5px;
            font-size: 12px;
            line-height: 1.6;
            overflow-wrap: anywhere;
          }

          .success {
            color: #b9edc5;
            background: #102116;
            border: 1px solid #24482e;
          }

          .error {
            color: #ffbcbc;
            background: #261111;
            border: 1px solid #542626;
          }

          .info {
            color: #ddd;
            background: #1b1b1b;
            border: 1px solid #333;
          }

          .footnote {
            margin-top: 30px;
            text-align: center;
          }

          .auth-footer {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
            padding: 25px 7%;
            border-top: 1px solid #202020;
          }

          @keyframes enter {
            from {
              opacity: 0;
              transform: translateY(14px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @media (max-width: 480px) {
            .auth-nav {
              height: 68px;
              padding: 0 20px;
            }

            .nav-caption {
              font-size: 8px;
              letter-spacing: 1px;
            }

            .auth-content {
              margin-top: 52px;
            }

            .auth-card {
              padding: 21px;
            }

            h1 {
              letter-spacing: -2px;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            *,
            *::before,
            *::after {
              animation: none !important;
              transition: none !important;
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main
      className={`dashboard bg-${backgroundStyle}`}
      style={dashboardStyle}
    >
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <aside className="sidebar">
        <a href="/" className="sidebar-brand">
          OBLIVN<span>.</span>
        </a>

        <div className="sidebar-label">
          WORKSPACE
        </div>

        <div className="sidebar-item active">
          <span>▦</span>
          Dashboard
        </div>

        <a
          className="sidebar-item"
          href={profileUrl || "#"}
          target="_blank"
          rel="noreferrer"
        >
          <span>↗</span>
          Public profile
        </a>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="avatar">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Profile" />
              ) : (
                (
                  displayName ||
                  session.user.email ||
                  "O"
                )
                  .charAt(0)
                  .toUpperCase()
              )}
            </div>

            <div className="sidebar-user-text">
              <strong>
                {displayName || "Your account"}
              </strong>

              <span>{session.user.email}</span>
            </div>
          </div>

          <button
            className="logout-button"
            type="button"
            onClick={handleLogout}
            disabled={busy}
          >
            ↗ &nbsp; Log out
          </button>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div>
            <span className="breadcrumb">
              WORKSPACE /
            </span>

            <span className="breadcrumb-current">
              {" "}DASHBOARD
            </span>
          </div>

          <div className="topbar-right">
            <span className="live-indicator" />
            ALL SYSTEMS NORMAL
          </div>
        </header>

        <div className="content">
          <div className="welcome-row">
            <div>
              <div className="section-eyebrow">
                <span className="eyebrow-line" />
                YOUR PERSONAL SPACE
              </div>

              <h1>
                Make it <span>yours.</span>
              </h1>

              <p className="welcome-description">
                Your corner of the internet. Curate it your way.
              </p>
            </div>

            <div className="date-chip">
              <span className="date-chip-dot" />
              YOUR WORKSPACE
            </div>
          </div>

          {message && (
            <div
              className={`message dashboard-message ${messageType}`}
            >
              <span>{message}</span>

              <button
                type="button"
                onClick={() => setMessage("")}
                aria-label="Dismiss message"
              >
                ×
              </button>
            </div>
          )}

          <section className="analytics-card">
            <div className="analytics-top">
              <div>
                <div className="panel-number">
                  01 / ANALYTICS
                </div>

                <h2>Profile views</h2>

                <p>
                  Every visit. Every connection. Your space.
                </p>
              </div>

              <div className="analytics-icon">↗</div>
            </div>

            <div className="analytics-number">
              {analyticsLoading
                ? "..."
                : totalViews.toLocaleString("en-US")}
            </div>

            <div className="analytics-label">
              TOTAL PROFILE VIEWS
            </div>

            <div className="analytics-footer">
              <span className="analytics-dot" />
              YOUR PROFILE ACTIVITY

              <span className="footer-right">
                OBLIVN / INSIGHTS
              </span>
            </div>
          </section>

          <form onSubmit={saveEverything}>
            <div className="dashboard-grid">
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-number">
                      02 / IDENTITY
                    </div>

                    <h2>Your profile</h2>
                  </div>

                  <span className="panel-icon">◈</span>
                </div>

                <div className="profile-preview">
                  <div className="preview-avatar">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Profile preview"
                      />
                    ) : (
                      (
                        displayName ||
                        username ||
                        "O"
                      )
                        .charAt(0)
                        .toUpperCase()
                    )}
                  </div>

                  <div className="preview-text">
                    <strong>
                      {displayName || "Your name"}
                    </strong>

                    <span>
                      @{username || "yourusername"}
                    </span>
                  </div>

                  <span className="preview-badge">
                    LIVE PREVIEW
                  </span>
                </div>

                <label htmlFor="avatar-upload">
                  PROFILE PICTURE
                </label>

                <input
                  id="avatar-upload"
                  className="file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleAvatarChange}
                  disabled={busy}
                />

                <p className="input-hint">
                  JPG, PNG, WEBP or GIF · Maximum 5 MB.
                </p>

                <label htmlFor="displayName">
                  DISPLAY NAME
                </label>

                <input
                  id="displayName"
                  type="text"
                  placeholder="What should people call you?"
                  value={displayName}
                  onChange={(event) =>
                    setDisplayName(event.target.value)
                  }
                  maxLength={60}
                />

                <label htmlFor="username">
                  USERNAME
                </label>

                <div className="username-input">
                  <span>@</span>

                  <input
                    id="username"
                    type="text"
                    placeholder="yourusername"
                    value={username}
                    onChange={(event) =>
                      setUsername(
                        event.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_]/g, "")
                      )
                    }
                    minLength={3}
                    maxLength={30}
                    required
                  />
                </div>

                <p className="input-hint">
                  Your public link will be /
                  {username || "yourusername"}
                </p>

                <label htmlFor="bio">BIO</label>

                <textarea
                  id="bio"
                  placeholder="A little about yourself..."
                  value={bio}
                  onChange={(event) =>
                    setBio(event.target.value)
                  }
                  maxLength={160}
                  rows={4}
                />

                <div className="character-count">
                  {bio.length}/160
                </div>
              </section>

              {/* LIVE CUSTOMIZATION */}

              <section className="panel customization-panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-number">
                      03 / PERSONALIZATION
                    </div>

                    <h2>Make it yours</h2>
                  </div>

                  <span className="panel-icon">✳</span>
                </div>

                <p className="panel-description">
                  Your identity. Your aesthetic. Your rules.
                </p>

                <label>CHOOSE YOUR THEME</label>

                <div className="theme-grid">
                  {Object.entries(THEMES).map(
                    ([key, item]) => (
                      <button
                        type="button"
                        key={key}
                        className={`theme-option ${
                          theme === key ? "selected" : ""
                        }`}
                        onClick={() => selectTheme(key)}
                        aria-pressed={theme === key}
                      >
                        <span
                          className="theme-swatch"
                          style={{
                            "--swatch": item.color,
                          }}
                        />

                        <span className="theme-name">
                          {item.label}
                        </span>

                        <span className="theme-check">
                          {theme === key ? "✓" : ""}
                        </span>
                      </button>
                    )
                  )}
                </div>

                <label htmlFor="accent-color">
                  CUSTOM ACCENT COLOR
                </label>

                <div className="color-picker-row">
                  <input
                    id="accent-color"
                    className="color-input"
                    type="color"
                    value={accentColor}
                    onChange={(event) =>
                      setAccentColor(event.target.value)
                    }
                    aria-label="Choose accent color"
                  />

                  <div className="color-picker-info">
                    <strong>{accentColor.toUpperCase()}</strong>

                    <span>
                      Personalize your profile color
                    </span>
                  </div>

                  <button
                    type="button"
                    className="reset-color"
                    onClick={() =>
                      setAccentColor(THEMES[theme].color)
                    }
                  >
                    RESET
                  </button>
                </div>

                <label htmlFor="background-style">
                  BACKGROUND STYLE
                </label>

                <select
                  id="background-style"
                  value={backgroundStyle}
                  onChange={(event) =>
                    setBackgroundStyle(event.target.value)
                  }
                >
                  {BACKGROUNDS.map((background) => (
                    <option
                      key={background.value}
                      value={background.value}
                    >
                      {background.label}
                    </option>
                  ))}
                </select>

                <div className="preview-heading">
                  <span>LIVE PREVIEW</span>
                  <span className="preview-live-dot" />
                </div>

                <div className="mini-profile">
                  <div className="mini-profile-glow" />

                  <div className="mini-avatar">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Live avatar preview"
                      />
                    ) : (
                      (
                        displayName ||
                        username ||
                        "O"
                      )
                        .charAt(0)
                        .toUpperCase()
                    )}
                  </div>

                  <h3>
                    {displayName || "Your Name"}
                  </h3>

                  <p className="mini-username">
                    @{username || "yourusername"}
                  </p>

                  <p className="mini-bio">
                    {bio || "Your bio will appear here."}
                  </p>

                  <div className="mini-links">
                    {links
                      .filter(
                        (link) =>
                          link.title.trim() &&
                          link.url.trim()
                      )
                      .slice(0, 3)
                      .map((link, index) => (
                        <div
                          className="mini-link"
                          key={`${index}-${link.title}`}
                        >
                          <span>{link.title}</span>
                          <span>↗</span>
                        </div>
                      ))}

                    {!links.some(
                      (link) =>
                        link.title.trim() &&
                        link.url.trim()
                    ) && (
                      <div className="mini-link">
                        <span>Your links appear here</span>
                        <span>↗</span>
                      </div>
                    )}
                  </div>

                  <div className="mini-brand">
                    POWERED BY OBLIVN
                  </div>
                </div>

                <p className="input-hint">
                  Preview updates instantly. Save changes to
                  store your customization.
                </p>
              </section>
            </div>

            {/* LINKS */}

            <section className="panel links-panel">
              <div className="panel-header">
                <div>
                  <div className="panel-number">
                    04 / CONNECTIONS
                  </div>

                  <h2>Your links</h2>
                </div>

                <span className="link-count">
                  {links.length}/{MAX_LINKS}
                </span>
              </div>

              <p className="panel-description">
                Bring your favourite corners of the internet together.
              </p>

              <div className="links-list">
                {links.map((link, index) => (
                  <div className="link-editor" key={index}>
                    <div className="link-editor-top">
                      <span className="link-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <span className="link-editor-label">
                        LINK DESTINATION
                      </span>

                      <button
                        className="remove-link"
                        type="button"
                        onClick={() => removeLink(index)}
                        aria-label={`Remove link ${index + 1}`}
                      >
                        ×
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Link title (e.g. Instagram)"
                      value={link.title}
                      onChange={(event) =>
                        updateLink(
                          index,
                          "title",
                          event.target.value
                        )
                      }
                      maxLength={60}
                    />

                    <input
                      type="text"
                      placeholder="https://example.com"
                      value={link.url}
                      onChange={(event) =>
                        updateLink(
                          index,
                          "url",
                          event.target.value
                        )
                      }
                      maxLength={2048}
                    />
                  </div>
                ))}
              </div>

              {links.length < MAX_LINKS && (
                <button
                  className="add-link-button"
                  type="button"
                  onClick={addLink}
                >
                  ＋ ADD ANOTHER LINK
                  <span>↗</span>
                </button>
              )}

              {links.length === 0 && (
                <div className="empty-links">
                  <span>↗</span>
                  <p>Your links will live here.</p>
                  <small>
                    Add your first link to get started.
                  </small>
                </div>
              )}
            </section>

            <section className="publish-bar">
              <div className="publish-info">
                <span className="publish-dot" />

                <div>
                  <strong>Your space, your rules.</strong>

                  <p>
                    Save your changes to update your settings.
                  </p>
                </div>
              </div>

              <button
                className="save-button"
                type="submit"
                disabled={busy}
              >
                {busy ? "SAVING..." : "SAVE CHANGES"}
                {!busy && <span>↗</span>}
              </button>
            </section>
          </form>

          <section className="public-card">
            <div className="public-card-icon">↗</div>

            <div className="public-card-content">
              <div className="panel-number">
                05 / GO LIVE
              </div>

              <h3>Your corner of the internet.</h3>

              <p>
                Your profile is accessible through your unique
                OBLIVN username.
              </p>

              <div className="public-url">
                <span>
                  {profileUrl || "Choose a username first"}
                </span>

                <button
                  type="button"
                  onClick={copyProfileLink}
                  disabled={!username.trim()}
                >
                  COPY LINK
                </button>
              </div>
            </div>

            <a
              href={profileUrl || "#"}
              className="view-profile-button"
              target="_blank"
              rel="noreferrer"
            >
              VIEW PROFILE ↗
            </a>
          </section>

          <footer className="dashboard-footer">
            <span>© 2026 OBLIVN</span>
            <span>LESS NOISE. MORE YOU.</span>
          </footer>
        </div>
      </section>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .dashboard {
          --accent: #a3a3a3;
          --accent-soft: #ffffff12;
          --accent-border: #ffffff40;

          position: relative;
          isolation: isolate;
          display: flex;
          min-height: 100vh;
          overflow: hidden;
          background: #080808;
          color: #f5f5f5;
          font-family: Arial, Helvetica, sans-serif;
        }

        .bg-gradient {
          background: linear-gradient(135deg, #090909, #151515, #080808);
        }

        .bg-solid {
          background: #050505;
        }

        .ambient {
          position: absolute;
          z-index: -1;
          width: 380px;
          height: 380px;
          border-radius: 50%;
          background: var(--accent);
          filter: blur(150px);
          pointer-events: none;
        }

        .ambient-one {
          top: -260px;
          right: 10%;
          opacity: 0.08;
        }

        .ambient-two {
          bottom: -300px;
          left: 30%;
          opacity: 0.035;
        }

        .bg-solid .ambient {
          display: none;
        }

        button,
        input,
        textarea,
        select {
          font: inherit;
        }

        button:focus-visible,
        a:focus-visible,
        input:focus-visible,
        textarea:focus-visible,
        select:focus-visible {
          outline: 1px solid var(--accent);
          outline-offset: 3px;
        }

        button:disabled {
          opacity: 0.55;
          cursor: wait;
        }

        .sidebar {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          width: 230px;
          min-height: 100vh;
          padding: 30px 18px;
          background: #0b0b0b;
          border-right: 1px solid #242424;
          animation: enter-left 0.6s ease both;
        }

        .sidebar-brand {
          padding: 0 12px 45px;
          color: white;
          font-size: 25px;
          font-weight: 900;
          letter-spacing: -1.7px;
          text-decoration: none;
        }

        .sidebar-brand span {
          color: var(--accent);
        }

        .sidebar-label {
          padding: 0 12px;
          margin-bottom: 13px;
          color: #666;
          font: 9px "Courier New", monospace;
          letter-spacing: 2px;
        }

        .sidebar-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 12px;
          margin-bottom: 5px;
          border: 1px solid transparent;
          border-radius: 5px;
          color: #888;
          font-size: 12px;
          text-decoration: none;
          transition: 0.25s;
        }

        .sidebar-item span {
          font-size: 17px;
        }

        .sidebar-item.active {
          background: var(--accent-soft);
          border-color: var(--accent-border);
          color: white;
        }

        .sidebar-item:hover {
          color: white;
          border-color: #444;
          background: #191919;
          transform: translateX(3px);
        }

        .sidebar-bottom {
          margin-top: auto;
          padding-top: 22px;
          border-top: 1px solid #242424;
        }

        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          padding-bottom: 18px;
        }

        .avatar,
        .preview-avatar,
        .mini-avatar {
          display: grid;
          place-items: center;
          overflow: hidden;
          flex-shrink: 0;
          background: #191919;
          color: white;
          font-weight: 800;
        }

        .avatar {
          width: 35px;
          height: 35px;
          border: 1px solid #444;
          border-radius: 6px;
        }

        .avatar img,
        .preview-avatar img,
        .mini-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .sidebar-user-text {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
        }

        .sidebar-user-text strong,
        .sidebar-user-text span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sidebar-user-text strong {
          font-size: 11px;
        }

        .sidebar-user-text span {
          color: #777;
          font-size: 10px;
        }

        .logout-button {
          width: 100%;
          padding: 11px;
          border: 1px solid #292929;
          border-radius: 5px;
          background: transparent;
          color: #999;
          font-size: 11px;
          cursor: pointer;
          text-align: left;
          transition: 0.25s;
        }

        .logout-button:hover {
          color: white;
          border-color: var(--accent-border);
        }

        .main-area {
          flex: 1;
          min-width: 0;
          animation: enter 0.7s 0.08s ease both;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          height: 67px;
          padding: 0 4%;
          border-bottom: 1px solid #242424;
          background: #090909b8;
          backdrop-filter: blur(15px);
        }

        .breadcrumb,
        .breadcrumb-current {
          font: 9px "Courier New", monospace;
          letter-spacing: 1.3px;
        }

        .breadcrumb {
          color: #666;
        }

        .breadcrumb-current {
          color: #ddd;
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #888;
          font: 8px "Courier New", monospace;
          letter-spacing: 1px;
        }

        .live-indicator,
        .publish-dot,
        .date-chip-dot,
        .analytics-dot,
        .preview-live-dot {
          width: 6px;
          height: 6px;
          flex-shrink: 0;
          border-radius: 50%;
          background: var(--accent);
        }

        .live-indicator {
          animation: pulse 2s infinite;
        }

        .content {
          max-width: 1500px;
          margin: auto;
          padding: 40px 4% 25px;
        }

        .welcome-row {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 27px;
        }

        .section-eyebrow,
        .panel-number {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #858585;
          font: 9px "Courier New", monospace;
          letter-spacing: 1.7px;
        }

        .eyebrow-line {
          width: 18px;
          height: 1px;
          background: var(--accent);
        }

        .welcome-row h1 {
          margin: 13px 0 10px;
          font-size: clamp(36px, 4vw, 48px);
          line-height: 1.1;
          letter-spacing: -2.8px;
        }

        .welcome-row h1 span {
          color: var(--accent);
        }

        .welcome-description {
          margin: 0;
          color: #858585;
          font-size: 12px;
          line-height: 1.7;
        }

        .date-chip {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 11px 13px;
          border: 1px solid #303030;
          border-radius: 4px;
          color: #aaa;
          font: 9px "Courier New", monospace;
          letter-spacing: 1px;
        }

        .dashboard-message {
          justify-content: space-between;
        }

        .message {
          display: flex;
          gap: 12px;
          padding: 13px 15px;
          margin-bottom: 20px;
          border-radius: 5px;
          font-size: 12px;
          line-height: 1.6;
          overflow-wrap: anywhere;
          animation: enter 0.25s ease both;
        }

        .message button {
          border: none;
          background: transparent;
          color: inherit;
          font-size: 18px;
          cursor: pointer;
        }

        .success {
          color: #b9edc5;
          background: #102116;
          border: 1px solid #24482e;
        }

        .error {
          color: #ffbcbc;
          background: #261111;
          border: 1px solid #542626;
        }

        .info {
          color: #ddd;
          background: #1b1b1b;
          border: 1px solid #333;
        }

        .analytics-card,
        .panel,
        .publish-bar,
        .public-card {
          border: 1px solid #292929;
          border-radius: 8px;
          background: linear-gradient(145deg, #121212, #0b0b0b);
          transition: border-color 0.3s, transform 0.3s;
        }

        .analytics-card {
          position: relative;
          overflow: hidden;
          padding: 25px;
          margin-bottom: 20px;
          animation: enter 0.6s 0.1s ease both;
        }

        .analytics-card::before {
          position: absolute;
          top: -120px;
          right: -70px;
          width: 250px;
          height: 230px;
          border-radius: 50%;
          background: var(--accent);
          opacity: 0.08;
          filter: blur(80px);
          content: "";
          pointer-events: none;
        }

        .analytics-card:hover,
        .panel:hover,
        .public-card:hover {
          border-color: var(--accent-border);
        }

        .analytics-top {
          position: relative;
          display: flex;
          justify-content: space-between;
          gap: 15px;
        }

        .analytics-top h2,
        .panel-header h2 {
          margin: 10px 0 7px;
          font-size: 20px;
          letter-spacing: -0.6px;
        }

        .analytics-top p,
        .panel-description {
          color: #888;
          font-size: 11px;
          line-height: 1.7;
        }

        .analytics-icon {
          display: grid;
          place-items: center;
          width: 43px;
          height: 43px;
          border: 1px solid var(--accent-border);
          border-radius: 6px;
          color: var(--accent);
          font-size: 21px;
        }

        .analytics-number {
          position: relative;
          margin-top: 25px;
          font-size: clamp(43px, 6vw, 63px);
          font-weight: 800;
          letter-spacing: -4px;
          font-variant-numeric: tabular-nums;
        }

        .analytics-label {
          margin-top: 10px;
          color: #777;
          font: 9px "Courier New", monospace;
          letter-spacing: 2px;
        }

        .analytics-footer {
          position: relative;
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 24px;
          padding-top: 15px;
          border-top: 1px solid #292929;
          color: #777;
          font: 9px "Courier New", monospace;
          letter-spacing: 1px;
        }

        .footer-right {
          margin-left: auto;
          color: #555;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-items: start;
          gap: 18px;
        }

        .panel {
          min-width: 0;
          padding: 23px;
          margin-bottom: 18px;
          animation: enter 0.6s ease both;
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 22px;
        }

        .panel-header h2 {
          margin-top: 9px;
        }

        .panel-icon {
          color: var(--accent);
          font-size: 23px;
        }

        .profile-preview {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          padding: 13px;
          margin-bottom: 25px;
          border: 1px solid #292929;
          border-radius: 6px;
          background: #090909;
        }

        .preview-avatar {
          width: 43px;
          height: 43px;
          border-radius: 5px;
          background: var(--accent);
          color: black;
          font-size: 20px;
        }

        .preview-text {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }

        .preview-text strong,
        .preview-text span {
          overflow-wrap: anywhere;
        }

        .preview-text strong {
          font-size: 13px;
        }

        .preview-text span {
          color: #888;
          font-size: 11px;
        }

        .preview-badge {
          margin-left: auto;
          flex-shrink: 0;
          padding: 5px;
          border: 1px solid #303030;
          border-radius: 3px;
          color: var(--accent);
          font: 8px "Courier New", monospace;
        }

        .panel label {
          display: block;
          margin: 20px 0 9px;
          color: #999;
          font: 9px "Courier New", monospace;
          letter-spacing: 1.2px;
        }

        .panel input:not([type="color"]),
        .panel textarea,
        .panel select {
          display: block;
          width: 100%;
          min-width: 0;
          min-height: 44px;
          padding: 12px;
          border: 1px solid #303030;
          border-radius: 5px;
          outline: none;
          background: #090909;
          color: #eee;
          font-size: 12px;
          transition: border-color 0.25s, background 0.25s;
        }

        .panel input:focus,
        .panel textarea:focus,
        .panel select:focus {
          border-color: var(--accent);
        }

        .panel input::placeholder,
        .panel textarea::placeholder {
          color: #555;
        }

        .panel .file-input {
          padding: 9px;
          font-size: 11px;
        }

        .username-input {
          display: flex;
          align-items: center;
          padding-left: 12px;
          border: 1px solid #303030;
          border-radius: 5px;
          background: #090909;
        }

        .username-input:focus-within {
          border-color: var(--accent);
        }

        .username-input > span {
          color: var(--accent);
          font-size: 13px;
        }

        .username-input input {
          border: none !important;
          background: transparent !important;
        }

        .input-hint {
          margin: 8px 0 0;
          color: #777;
          font-size: 10px;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }

        .panel textarea {
          min-height: 90px;
          resize: vertical;
          line-height: 1.7;
        }

        .character-count {
          margin-top: 7px;
          color: #666;
          font: 9px "Courier New", monospace;
          text-align: right;
        }

        /* CUSTOMIZATION */

        .theme-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 9px;
        }

        .theme-option {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 57px;
          padding: 11px;
          border: 1px solid #303030;
          border-radius: 5px;
          background: #090909;
          color: #ddd;
          text-align: left;
          cursor: pointer;
          transition: border-color 0.25s, background 0.25s, transform 0.25s;
        }

        .theme-option:hover {
          transform: translateY(-2px);
          border-color: #666;
        }

        .theme-option.selected {
          border-color: var(--accent);
          background: var(--accent-soft);
        }

        .theme-swatch {
          width: 13px;
          height: 13px;
          flex-shrink: 0;
          border-radius: 50%;
          background: var(--swatch);
          box-shadow: 0 0 12px color-mix(in srgb, var(--swatch) 35%, transparent);
        }

        .theme-name {
          font-size: 11px;
        }

        .theme-check {
          margin-left: auto;
          color: var(--accent);
          font-size: 12px;
        }

        .color-picker-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1px solid #303030;
          border-radius: 5px;
          background: #090909;
        }

        .panel .color-input {
          display: block;
          width: 39px;
          height: 39px;
          min-height: 39px;
          flex-shrink: 0;
          padding: 3px;
          border: 1px solid #444;
          border-radius: 5px;
          background: #111;
          cursor: pointer;
        }

        .color-picker-info {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
        }

        .color-picker-info strong {
          font: 11px "Courier New", monospace;
        }

        .color-picker-info span {
          color: #777;
          font-size: 10px;
        }

        .reset-color {
          padding: 7px;
          margin-left: auto;
          border: 1px solid #333;
          border-radius: 3px;
          background: transparent;
          color: #aaa;
          font: 9px "Courier New", monospace;
          cursor: pointer;
        }

        .reset-color:hover {
          border-color: var(--accent);
          color: white;
        }

        .preview-heading {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 27px;
          margin-bottom: 12px;
          color: #888;
          font: 9px "Courier New", monospace;
          letter-spacing: 1.4px;
        }

        .preview-live-dot {
          box-shadow: 0 0 9px var(--accent);
        }

        .mini-profile {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          padding: 23px 15px;
          border: 1px solid var(--accent-border);
          border-radius: 8px;
          background: #070707;
          text-align: center;
        }

        .mini-profile::before {
          position: absolute;
          z-index: -1;
          inset: 0;
          background: linear-gradient(160deg, #141414, #050505 65%);
          opacity: 1;
          content: "";
        }

        .mini-profile:has(.mini-profile-glow)::after {
          position: absolute;
          z-index: -1;
          top: -100px;
          left: 50%;
          width: 180px;
          height: 180px;
          border-radius: 50%;
          background: var(--accent);
          opacity: 0.13;
          filter: blur(70px);
          transform: translateX(-50%);
          content: "";
          pointer-events: none;
        }

        .mini-avatar {
          width: 59px;
          height: 59px;
          margin: 0 auto;
          border: 1px solid var(--accent-border);
          border-radius: 50%;
          background: #171717;
          color: var(--accent);
          font-size: 22px;
        }

        .mini-profile h3 {
          margin: 14px 0 5px;
          font-size: 15px;
        }

        .mini-username {
          margin: 0;
          color: var(--accent);
          font-size: 10px;
        }

        .mini-bio {
          margin: 12px 0 18px;
          color: #999;
          font-size: 10px;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }

        .mini-links {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .mini-link {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 11px;
          border: 1px solid var(--accent-border);
          border-radius: 4px;
          background: var(--accent-soft);
          color: white;
          font-size: 10px;
          text-align: left;
          overflow-wrap: anywhere;
          transition: transform 0.2s, background 0.2s;
        }

        .mini-link:hover {
          transform: translateY(-2px);
        }

        .mini-brand {
          margin-top: 20px;
          color: #666;
          font: 8px "Courier New", monospace;
          letter-spacing: 2px;
        }

        /* LINKS */

        .links-panel {
          animation-delay: 0.1s;
        }

        .panel-description {
          margin: -10px 0 22px;
        }

        .link-count {
          padding: 7px 10px;
          border: 1px solid #333;
          border-radius: 4px;
          color: var(--accent);
          font: 10px "Courier New", monospace;
        }

        .links-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .link-editor {
          padding: 13px;
          border: 1px solid #2b2b2b;
          border-radius: 6px;
          background: #0b0b0b;
          animation: enter 0.3s ease both;
          transition: border-color 0.25s;
        }

        .link-editor:hover {
          border-color: #555;
        }

        .link-editor-top {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 12px;
        }

        .link-index {
          display: grid;
          place-items: center;
          width: 25px;
          height: 25px;
          border: 1px solid #333;
          border-radius: 4px;
          color: var(--accent);
          font: 9px "Courier New", monospace;
        }

        .link-editor-label {
          color: #777;
          font: 9px "Courier New", monospace;
          letter-spacing: 1.2px;
        }

        .remove-link {
          display: grid;
          place-items: center;
          width: 27px;
          height: 27px;
          margin-left: auto;
          border: 1px solid #303030;
          border-radius: 4px;
          background: transparent;
          color: #aaa;
          font-size: 18px;
          cursor: pointer;
        }

        .remove-link:hover {
          border-color: #888;
          color: white;
        }

        .link-editor input + input {
          margin-top: 8px;
        }

        .add-link-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          min-height: 43px;
          padding: 10px;
          margin-top: 15px;
          border: 1px dashed #424242;
          border-radius: 5px;
          background: transparent;
          color: #aaa;
          font: 10px "Courier New", monospace;
          letter-spacing: 1.2px;
          cursor: pointer;
          transition: 0.25s;
        }

        .add-link-button:hover {
          border-color: var(--accent);
          color: var(--accent);
        }

        .empty-links {
          padding: 30px 10px;
          border: 1px dashed #303030;
          border-radius: 6px;
          text-align: center;
        }

        .empty-links > span {
          color: var(--accent);
          font-size: 25px;
        }

        .empty-links p {
          margin: 12px 0 7px;
          font-size: 12px;
        }

        .empty-links small {
          color: #777;
          font-size: 10px;
        }

        .publish-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 17px 20px;
          margin-top: 18px;
          background: linear-gradient(110deg, #151515, #101010);
        }

        .publish-info {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .publish-info strong {
          font-size: 11px;
        }

        .publish-info p {
          margin: 5px 0 0;
          color: #858585;
          font-size: 10px;
          line-height: 1.6;
        }

        .save-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 13px;
          min-width: 155px;
          min-height: 43px;
          padding: 0 16px;
          flex-shrink: 0;
          border: 1px solid var(--accent);
          border-radius: 4px;
          background: var(--accent);
          color: #080808;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
          cursor: pointer;
          transition: transform 0.25s, filter 0.25s;
        }

        .save-button:hover:not(:disabled) {
          filter: brightness(1.12);
          transform: translateY(-2px);
        }

        .public-card {
          display: flex;
          align-items: flex-start;
          gap: 18px;
          padding: 23px;
          margin-top: 18px;
          animation: enter 0.6s 0.2s ease both;
        }

        .public-card-icon {
          display: grid;
          place-items: center;
          width: 43px;
          height: 43px;
          flex-shrink: 0;
          border: 1px solid var(--accent-border);
          border-radius: 6px;
          color: var(--accent);
          font-size: 19px;
        }

        .public-card-content {
          flex: 1;
          min-width: 0;
        }

        .public-card-content h3 {
          margin: 10px 0;
          font-size: 17px;
        }

        .public-card-content > p {
          margin: 0 0 17px;
          color: #858585;
          font-size: 11px;
          line-height: 1.8;
        }

        .public-url {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 7px 8px 7px 12px;
          border: 1px solid #2c2c2c;
          border-radius: 4px;
          background: #080808;
        }

        .public-url > span {
          min-width: 0;
          color: #aaa;
          font-size: 11px;
          overflow-wrap: anywhere;
        }

        .public-url button {
          flex-shrink: 0;
          padding: 8px;
          border: 1px solid #383838;
          border-radius: 3px;
          background: #1b1b1b;
          color: white;
          font: 8px "Courier New", monospace;
          cursor: pointer;
        }

        .view-profile-button {
          padding: 11px 12px;
          border: 1px solid #383838;
          border-radius: 4px;
          color: #ddd;
          font: 9px "Courier New", monospace;
          text-decoration: none;
          white-space: nowrap;
          transition: 0.25s;
        }

        .view-profile-button:hover {
          border-color: var(--accent);
          background: var(--accent);
          color: #080808;
        }

        .dashboard-footer {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 25px 0 5px;
          color: #666;
          font: 9px "Courier New", monospace;
          letter-spacing: 1.2px;
        }

        @keyframes enter {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes enter-left {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulse {
          50% {
            opacity: 0.45;
          }
        }

        @media (max-width: 1100px) {
          .sidebar {
            width: 200px;
          }

          .dashboard-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        @media (max-width: 650px) {
          .dashboard {
            display: block;
          }

          .sidebar {
            width: 100%;
            min-height: auto;
            padding: 17px 20px;
            border-right: none;
            border-bottom: 1px solid #242424;
          }

          .sidebar-brand {
            padding: 0;
            font-size: 22px;
          }

          .sidebar-label,
          .sidebar-item,
          .sidebar-bottom {
            display: none;
          }

          .topbar {
            height: 53px;
            padding: 0 20px;
          }

          .topbar-right {
            font-size: 7px;
          }

          .content {
            padding: 30px 15px 20px;
          }

          .welcome-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .welcome-row h1 {
            font-size: 40px;
          }

          .analytics-card,
          .panel {
            padding: 19px;
          }

          .analytics-number {
            font-size: 48px;
          }

          .analytics-footer {
            flex-wrap: wrap;
            font-size: 8px;
          }

          .publish-bar {
            align-items: stretch;
            flex-direction: column;
            padding: 16px;
          }

          .save-button {
            width: 100%;
          }

          .public-card {
            flex-wrap: wrap;
            padding: 17px;
            gap: 12px;
          }

          .public-card-content {
            flex-basis: 100%;
          }

          .view-profile-button {
            margin-left: 0;
          }

          .public-url {
            align-items: stretch;
            flex-direction: column;
          }

          .public-url button {
            width: 100%;
          }

          .dashboard-footer {
            font-size: 8px;
          }
        }

        @media (max-width: 380px) {
          .theme-grid {
            grid-template-columns: 1fr;
          }

          .color-picker-row {
            flex-wrap: wrap;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </main>
  );
}