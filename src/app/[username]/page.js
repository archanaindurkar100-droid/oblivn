"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function getSafeUrl(url) {
  if (!url || typeof url !== "string") return null;

  try {
    const normalized = /^https?:\/\//i.test(url)
      ? url
      : "https://" + url;

    const parsed = new URL(normalized);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    return parsed.href;
  } catch {
    return null;
  }
}

function getSafeAccent(value) {
  return typeof value === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : "#ffffff";
}

function getThemeSettings(profile) {
  const theme = ["midnight", "white", "gradient"].includes(
    profile?.theme
  )
    ? profile.theme
    : "midnight";

  const backgroundStyle = [
    "solid",
    "glow",
    "gradient",
  ].includes(profile?.background_style)
    ? profile.background_style
    : "glow";

  const accent = getSafeAccent(profile?.accent_color);

  const palettes = {
    midnight: {
      background: "#050505",
      text: "#f5f5f5",
      muted: "#929292",
      border: "rgba(255,255,255,0.12)",
      surface: "rgba(255,255,255,0.025)",
      grid: "rgba(255,255,255,0.035)",
      accent,
    },

    white: {
      background: "#f6f6f6",
      text: "#111111",
      muted: "#666666",
      border: "rgba(0,0,0,0.14)",
      surface: "rgba(0,0,0,0.025)",
      grid: "rgba(0,0,0,0.035)",
      accent,
    },

    gradient: {
      background: "#080710",
      text: "#ffffff",
      muted: "#b3aec1",
      border: "rgba(255,255,255,0.16)",
      surface: "rgba(255,255,255,0.045)",
      grid: "rgba(255,255,255,0.035)",
      accent,
    },
  };

  const palette = palettes[theme];

  let background = palette.background;

  if (backgroundStyle === "gradient") {
    background =
      theme === "white"
        ? "linear-gradient(135deg, #ffffff 0%, #e9e9f4 50%, #f6f6f6 100%)"
        : "linear-gradient(135deg, #050505 0%, #171024 50%, #050505 100%)";
  }

  return {
    ...palette,
    theme,
    backgroundStyle,
    background,
  };
}

export default function PublicProfile() {
  const params = useParams();
  const username = params?.username;

  const [profile, setProfile] = useState(null);
  const [links, setLinks] = useState([]);
  const [viewCount, setViewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!username) return;

    let active = true;

    async function loadProfile() {
      setLoading(true);
      setFailed(false);

      try {
        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select(
            "user_id, username, display_name, bio, avatar_url, theme, accent_color, background_style"
          )
          .eq("username", username)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (!profileData) {
          if (active) {
            setProfile(null);
            setLinks([]);
            setFailed(true);
            setLoading(false);
          }

          return;
        }

        const {
          data: viewsData,
          error: viewsError,
        } = await supabase.rpc("record_profile_view", {
          profile_username: username,
        });

        if (viewsError) {
          console.error(
            "Could not record profile view:",
            viewsError
          );
        } else if (active) {
          setViewCount(Number(viewsData) || 0);
        }

        const {
          data: linkData,
          error: linkError,
        } = await supabase
          .from("links")
          .select("id, title, url, position")
          .eq("user_id", profileData.user_id)
          .order("position", { ascending: true });

        if (linkError) {
          throw linkError;
        }

        if (active) {
          setProfile(profileData);
          setLinks(linkData || []);
          setLoading(false);
        }
      } catch (error) {
        console.error("OBLIVN profile error:", error);

        if (active) {
          setFailed(true);
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [username]);

  const displayName =
    profile?.display_name?.trim() ||
    profile?.username ||
    "Unknown";

  const visibleLinks = links.filter(
    (link) => link.title?.trim() && getSafeUrl(link.url)
  );

  const theme = getThemeSettings(profile);

  const pageStyle = {
    "--page-bg": theme.background,
    "--page-text": theme.text,
    "--page-muted": theme.muted,
    "--page-border": theme.border,
    "--page-surface": theme.surface,
    "--page-grid": theme.grid,
    "--page-accent": theme.accent,
    background: theme.background,
    color: theme.text,
  };

  if (loading) {
    return (
      <main className="oblivn-loading-page">
        <div className="loading-content">
          <div className="loading-symbol">O</div>

          <p className="mono loading-label">
            SYSTEM / INITIALIZING
          </p>

          <h1 className="loading-logo">
            OBLIVN<span>.</span>
          </h1>

          <div className="loading-track">
            <div className="loading-progress" />
          </div>

          <p className="mono loading-caption">
            ENTERING THE VOID
          </p>
        </div>

        <style jsx>{`
          .oblivn-loading-page {
            display: flex;
            min-height: 100svh;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            background: #050505;
            color: white;
            font-family: Arial, sans-serif;
          }

          .loading-content {
            width: min(320px, 85vw);
            text-align: center;
            animation: reveal 0.8s ease both;
          }

          .loading-symbol {
            display: grid;
            width: 64px;
            height: 64px;
            place-items: center;
            margin: 0 auto 28px;
            border: 1px solid #383838;
            font-size: 30px;
            font-weight: 900;
          }

          .mono {
            font-family: "Courier New", monospace;
          }

          .loading-label,
          .loading-caption {
            color: #666;
            font-size: 9px;
            letter-spacing: 0.25em;
          }

          .loading-logo {
            margin-top: 18px;
            font-size: 34px;
            font-weight: 900;
            letter-spacing: 0.2em;
          }

          .loading-logo span {
            color: #777;
          }

          .loading-track {
            height: 1px;
            margin-top: 30px;
            overflow: hidden;
            background: #222;
          }

          .loading-progress {
            width: 40%;
            height: 100%;
            background: white;
            animation: progress 1.5s ease-in-out infinite;
          }

          .loading-caption {
            margin-top: 16px;
          }

          @keyframes reveal {
            from {
              opacity: 0;
              transform: translateY(14px);
            }

            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes progress {
            from {
              transform: translateX(-120%);
            }

            to {
              transform: translateX(350%);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .loading-content,
            .loading-progress {
              animation: none;
            }
          }
        `}</style>
      </main>
    );
  }

  if (failed || !profile) {
    return (
      <main className="error-page">
        <div className="error-content">
          <p className="mono">OBLIVN / ERROR 404</p>

          <h1>
            LOST<span>.</span>
          </h1>

          <div className="error-line" />

          <p className="error-description">
            This archive does not exist or is currently unavailable.
          </p>

          <a href="/" className="return-button">
            RETURN TO OBLIVN <span>↗</span>
          </a>
        </div>

        <style jsx>{`
          .error-page {
            display: flex;
            min-height: 100svh;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: #050505;
            color: white;
            font-family: Arial, sans-serif;
          }

          .error-content {
            width: 100%;
            max-width: 450px;
            text-align: center;
            animation: reveal 0.8s ease both;
          }

          .mono {
            color: #777;
            font-family: "Courier New", monospace;
            font-size: 10px;
            letter-spacing: 0.2em;
          }

          h1 {
            margin-top: 24px;
            font-size: clamp(64px, 14vw, 100px);
            font-weight: 900;
            letter-spacing: -0.09em;
          }

          h1 span {
            color: #666;
          }

          .error-line {
            width: 42px;
            height: 1px;
            margin: 25px auto;
            background: #555;
          }

          .error-description {
            color: #888;
            font-size: 13px;
            line-height: 1.9;
          }

          .return-button {
            display: inline-flex;
            align-items: center;
            gap: 24px;
            margin-top: 32px;
            border: 1px solid #333;
            padding: 15px 18px;
            color: #ddd;
            font-family: "Courier New", monospace;
            font-size: 10px;
            letter-spacing: 0.12em;
            text-decoration: none;
            transition: 0.3s ease;
          }

          .return-button:hover {
            background: white;
            color: black;
          }

          @keyframes reveal {
            from {
              opacity: 0;
              transform: translateY(14px);
            }

            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main
      className={`oblivn-public theme-${theme.theme} background-${theme.backgroundStyle}`}
      style={pageStyle}
    >
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="grid-overlay" />
      <div className="grain-overlay" />

      <div className="profile-container">
        <header className="profile-header">
          <a href="/" className="brand">
            OBLIVN<span>.</span>
          </a>

          <div className="archive-label mono">
            <span className="status-dot" />
            Personal archive
          </div>
        </header>

        <section className="profile-hero">
          <div className="avatar-wrap">
            <div className="avatar-orbit" />

            <div className="avatar">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={`${displayName}'s profile picture`}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <span className="avatar-initial">
                  {displayName.charAt(0).toUpperCase()}
                  <span>.</span>
                </span>
              )}
            </div>

            <div className="avatar-frame" />
            <div className="avatar-frame-two" />

            <span className="online-indicator" />
          </div>

          <div className="profile-metadata mono">
            <span>Individual / 001</span>

            <span className="metadata-divider">|</span>

            <span>
              {viewCount.toLocaleString("en-US")} Profile Views
            </span>
          </div>

          <h1 className="display-name">
            {displayName}
            <span>.</span>
          </h1>

          <p className="username mono">
            @{profile.username}
          </p>

          {profile.bio?.trim() && (
            <p className="bio">{profile.bio}</p>
          )}

          <div className="tagline">
            <span />
            <p className="mono">The world within</p>
            <span />
          </div>
        </section>

        <section className="connections">
          <div className="connections-heading">
            <h2 className="mono">Connections</h2>

            <span className="mono link-count">
              {String(visibleLinks.length).padStart(2, "0")} / 06
            </span>
          </div>

          {visibleLinks.length > 0 ? (
            <div className="links-list">
              {visibleLinks.map((link, index) => (
                <a
                  key={link.id || `${link.title}-${index}`}
                  href={getSafeUrl(link.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="profile-link"
                  style={{ "--link-index": index }}
                >
                  <div className="link-left">
                    <span className="link-number mono">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <span className="link-title">
                      {link.title}
                    </span>
                  </div>

                  <span className="link-arrow">↗</span>
                </a>
              ))}
            </div>
          ) : (
            <div className="empty-state mono">
              Nothing here. Yet.
            </div>
          )}
        </section>

        <footer className="profile-footer">
          <p className="mono footer-caption">
            A little piece of the void
          </p>

          <a href="/" className="footer-link mono">
            ENTER OBLIVN <span>↗</span>
          </a>
        </footer>
      </div>

      <style jsx>{`
        .oblivn-public {
          --page-bg: #050505;
          --page-text: #f5f5f5;
          --page-muted: #929292;
          --page-border: rgba(255, 255, 255, 0.12);
          --page-surface: rgba(255, 255, 255, 0.025);
          --page-grid: rgba(255, 255, 255, 0.035);
          --page-accent: #ffffff;

          position: relative;
          isolation: isolate;
          min-height: 100svh;
          overflow: hidden;
          padding: 0 20px;
          background-color: var(--page-bg);
          color: var(--page-text);
          font-family: Arial, Helvetica, sans-serif;
          -webkit-font-smoothing: antialiased;
          text-rendering: optimizeLegibility;

          transition:
            background-color 0.4s ease,
            color 0.4s ease;
        }

        .mono {
          font-family: "Courier New", Courier, monospace;
        }

        .ambient {
          position: absolute;
          z-index: -1;
          width: 380px;
          height: 380px;
          border-radius: 50%;
          filter: blur(110px);
          pointer-events: none;
          opacity: 0.11;
          animation: ambientMove 14s ease-in-out infinite alternate;
        }

        .ambient-one {
          top: -140px;
          left: 50%;
          background: var(--page-accent);
          transform: translateX(-50%);
        }

        .ambient-two {
          top: 45%;
          right: -220px;
          background: var(--page-accent);
          opacity: 0.06;
          animation-duration: 18s;
        }

        .background-solid .ambient {
          opacity: 0;
        }

        .background-glow .ambient {
          opacity: 0.11;
        }

        .background-gradient .ambient {
          opacity: 0.16;
        }

        .grid-overlay {
          position: fixed;
          z-index: -1;
          inset: 0;
          pointer-events: none;
          opacity: 0.7;

          background-image:
            linear-gradient(
              var(--page-grid) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              var(--page-grid) 1px,
              transparent 1px
            );

          background-size: 80px 80px;

          mask-image: linear-gradient(
            to bottom,
            black,
            transparent 85%
          );
        }

        .grain-overlay {
          position: fixed;
          z-index: 5;
          inset: 0;
          pointer-events: none;
          opacity: 0.045;

          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E");
        }

        .profile-container {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 672px;
          min-height: 100svh;
          margin: 0 auto;
        }

        .profile-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 24px 0;
          border-bottom: 1px solid var(--page-border);
          animation: reveal 0.8s ease both;
        }

        .brand {
          color: var(--page-text);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.28em;
          text-decoration: none;
        }

        .brand span,
        .display-name > span {
          color: var(--page-accent);
          transition: color 0.3s ease;
        }

        .archive-label {
          display: flex;
          align-items: center;
          gap: 9px;
          color: var(--page-muted);
          font-size: 9px;
          letter-spacing: 0.17em;
          text-transform: uppercase;
        }

        .status-dot {
          width: 5px;
          height: 5px;
          background: var(--page-accent);
          box-shadow: 0 0 10px var(--page-accent);
          animation: statusPulse 3s ease-in-out infinite;
        }

        .profile-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 80px 0 48px;
          text-align: center;
          animation: reveal 0.9s 0.1s ease both;
        }

        .avatar-wrap {
          position: relative;
          display: grid;
          width: 112px;
          height: 112px;
          place-items: center;
          isolation: isolate;
        }

        .avatar {
          z-index: 1;
          display: grid;
          width: 100%;
          height: 100%;
          overflow: hidden;
          place-items: center;
          border: 1px solid var(--page-border);
          background: var(--page-surface);
          box-shadow: 0 0 0 6px var(--page-surface);
          transition: box-shadow 0.4s ease;
        }

        .avatar img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.7s ease;
        }

        .avatar-wrap:hover .avatar img {
          transform: scale(1.055);
        }

        .avatar-wrap:hover .avatar {
          box-shadow: 0 0 32px
            color-mix(
              in srgb,
              var(--page-accent) 18%,
              transparent
            );
        }

        .avatar-initial {
          font-size: 46px;
          font-weight: 900;
          letter-spacing: -0.1em;
        }

        .avatar-initial span {
          color: var(--page-accent);
        }

        .avatar-orbit {
          position: absolute;
          inset: -16px;
          border: 1px solid transparent;
          border-top-color: var(--page-border);
          border-bottom-color: var(--page-border);
          border-radius: 50%;
          animation: orbit 12s linear infinite;
        }

        .avatar-frame,
        .avatar-frame-two {
          position: absolute;
          inset: -8px;
          border: 1px solid var(--page-border);
          pointer-events: none;
          transition: transform 0.8s ease;
        }

        .avatar-frame {
          transform: rotate(45deg);
        }

        .avatar-frame-two {
          opacity: 0.5;
        }

        .avatar-wrap:hover .avatar-frame {
          transform: rotate(135deg);
        }

        .avatar-wrap:hover .avatar-frame-two {
          transform: rotate(45deg);
        }

        .online-indicator {
          position: absolute;
          right: 1px;
          bottom: 1px;
          z-index: 2;
          width: 10px;
          height: 10px;
          border: 1px solid var(--page-bg);
          background: var(--page-accent);
        }

        .profile-metadata {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 12px;
          margin-top: 30px;
          color: var(--page-muted);
          font-size: 9px;
          letter-spacing: 0.19em;
          text-transform: uppercase;
        }

        .metadata-divider {
          opacity: 0.45;
        }

        .display-name {
          max-width: 100%;
          margin-top: 17px;
          overflow-wrap: anywhere;
          font-size: clamp(34px, 8vw, 60px);
          font-weight: 900;
          line-height: 1.05;
          letter-spacing: -0.075em;
        }

        .username {
          margin-top: 15px;
          color: var(--page-muted);
          font-size: 12px;
          letter-spacing: 0.1em;
        }

        .bio {
          max-width: 440px;
          margin-top: 24px;
          color: var(--page-muted);
          font-size: 14px;
          line-height: 1.9;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .tagline {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-top: 30px;
        }

        .tagline > span {
          width: 32px;
          height: 1px;
          background: var(--page-border);
          transition: width 0.3s ease;
        }

        .tagline:hover > span {
          width: 44px;
        }

        .tagline p {
          color: var(--page-muted);
          font-size: 9px;
          letter-spacing: 0.25em;
          text-transform: uppercase;
        }

        .connections {
          padding-bottom: 64px;
          animation: reveal 0.8s 0.3s ease both;
        }

        .connections-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }

        .connections-heading h2,
        .link-count {
          color: var(--page-muted);
          font-size: 10px;
          letter-spacing: 0.25em;
          text-transform: uppercase;
        }

        .link-count {
          letter-spacing: 0.12em;
        }

        .links-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .profile-link {
          position: relative;
          display: flex;
          min-height: 68px;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          overflow: hidden;
          border: 1px solid var(--page-border);
          background: var(--page-surface);
          padding: 15px 20px;
          text-decoration: none;
          opacity: 0;

          animation: linkReveal 0.65s
            cubic-bezier(0.16, 1, 0.3, 1)
            calc(0.35s + var(--link-index, 0) * 0.09s)
            forwards;

          transition:
            transform 0.3s ease,
            border-color 0.3s ease,
            background 0.3s ease;
        }

        .profile-link::before {
          position: absolute;
          inset: 0;

          background: linear-gradient(
            105deg,
            transparent 20%,
            color-mix(
              in srgb,
              var(--page-accent) 9%,
              transparent
            ) 50%,
            transparent 80%
          );

          content: "";
          transform: translateX(-110%);
          transition: transform 0.65s ease;
          pointer-events: none;
        }

        .profile-link:hover {
          transform: translateY(-3px);
          border-color: var(--page-accent);
          background: var(--page-surface);
        }

        .profile-link:hover::before {
          transform: translateX(110%);
        }

        .link-left {
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 16px;
        }

        .link-number {
          display: grid;
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          place-items: center;
          border: 1px solid var(--page-border);
          color: var(--page-muted);
          font-size: 10px;
          transition: 0.3s ease;
        }

        .profile-link:hover .link-number {
          border-color: var(--page-accent);
          background: var(--page-accent);
          color: var(--page-bg);
        }

        .link-title {
          overflow-wrap: anywhere;
          color: var(--page-text);
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.025em;
          transition: letter-spacing 0.3s ease;
        }

        .profile-link:hover .link-title {
          letter-spacing: 0.045em;
        }

        .link-arrow {
          flex-shrink: 0;
          color: var(--page-muted);
          font-size: 18px;
          transition:
            transform 0.3s ease,
            color 0.3s ease;
        }

        .profile-link:hover .link-arrow {
          transform: translate(3px, -3px);
          color: var(--page-accent);
        }

        .empty-state {
          border: 1px dashed var(--page-border);
          padding: 38px 20px;
          color: var(--page-muted);
          text-align: center;
          font-size: 10px;
          letter-spacing: 0.2em;
        }

        .profile-footer {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border-top: 1px solid var(--page-border);
          padding: 24px 0;
          animation: reveal 0.8s 0.5s ease both;
        }

        .footer-caption,
        .footer-link {
          color: var(--page-muted);
          font-size: 9px;
          letter-spacing: 0.17em;
          text-transform: uppercase;
        }

        .footer-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--page-text);
          text-decoration: none;
          transition: color 0.3s ease;
        }

        .footer-link span {
          transition: transform 0.3s ease;
        }

        .footer-link:hover {
          color: var(--page-accent);
        }

        .footer-link:hover span {
          transform: translate(3px, -3px);
        }

        @keyframes reveal {
          from {
            opacity: 0;
            transform: translateY(15px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes linkReveal {
          from {
            opacity: 0;
            transform: translateY(16px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes orbit {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @keyframes ambientMove {
          from {
            transform: translate(-50%, 0) scale(1);
          }

          to {
            transform: translate(-45%, 60px) scale(1.15);
          }
        }

        @keyframes statusPulse {
          0%,
          100% {
            opacity: 0.45;
          }

          50% {
            opacity: 1;
          }
        }

        @media (max-width: 480px) {
          .oblivn-public {
            padding: 0 18px;
          }

          .profile-hero {
            padding-top: 66px;
          }

          .avatar-wrap {
            width: 100px;
            height: 100px;
          }

          .profile-metadata {
            gap: 8px;
            font-size: 8px;
            letter-spacing: 0.1em;
          }

          .profile-link {
            min-height: 64px;
            padding: 14px;
          }

          .link-left {
            gap: 12px;
          }

          .profile-footer {
            flex-direction: column;
            align-items: flex-start;
          }

          .ambient-one {
            width: 280px;
            height: 280px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .oblivn-public *,
          .oblivn-public *::before,
          .oblivn-public *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
          }

          .profile-link {
            opacity: 1;
          }
        }
      `}</style>
    </main>
  );
}