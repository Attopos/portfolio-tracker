import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { APP_ENV, isGoogleAuthConfigured } from "../config/env.js";

function getNextPath(search) {
  const params = new URLSearchParams(search);
  const rawNext = String(params.get("next") || "").trim();

  if (!rawNext || !rawNext.startsWith("/")) {
    return "/";
  }

  return rawNext;
}

function SignInPage() {
  const buttonRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { authError, isAuthenticated, isLoading, signIn } = useAuth();
  const [status, setStatus] = useState("Google auth: not signed in.");
  const nextPath = getNextPath(location.search);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(nextPath, { replace: true });
    }
  }, [isAuthenticated, navigate, nextPath]);

  useEffect(() => {
    let cancelled = false;

    async function setupGoogleButton() {
      if (!buttonRef.current) {
        return;
      }

      if (!isGoogleAuthConfigured()) {
        setStatus("Google sign-in is not available right now. Please try again later.");
        return;
      }

      setStatus("Loading Google sign-in...");

      if (!document.querySelector(`script[src="${APP_ENV.googleGsiSrc}"]`)) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = APP_ENV.googleGsiSrc;
          script.async = true;
          script.defer = true;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      if (cancelled || !window.google || !window.google.accounts || !window.google.accounts.id) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: APP_ENV.googleClientId,
        callback: async (response) => {
          const credential = String(response?.credential || "").trim();
          if (!credential) {
            setStatus("Google sign-in failed: missing credential.");
            return;
          }

          try {
            setStatus("Signing in...");
            await signIn(credential);
            navigate(nextPath, { replace: true });
          } catch (error) {
            setStatus(error instanceof Error ? error.message : "Google sign-in failed.");
          }
        },
      });

      buttonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
      });
      setStatus("Google sign-in button ready.");
    }

    setupGoogleButton().catch(() => {
      if (!cancelled) {
        setStatus("Google GIS failed to load.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [navigate, nextPath, signIn]);

  return (
    <section className="sign-in-page">
      <div className="sign-in-shell">
        <div className="sign-in-panel">
          <p className="page-eyebrow">Account Access</p>
          <h1>Sign in to your portfolio workspace</h1>
          <div className="sign-in-actions">
            <div ref={buttonRef} />
          </div>
          <p className="sign-in-status">
            {isLoading ? "Checking existing session..." : authError || status}
          </p>
        </div>
      </div>
    </section>
  );
}

export default SignInPage;
