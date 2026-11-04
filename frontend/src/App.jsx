import { useEffect, useState } from "react";
import "./App.css";
import TripPreferenceForm from "./TripPreferenceForm.jsx";
import { supabase } from "./supabase.js";

function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  async function handleAuth(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const result = isSigningUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      setMessage(result.error.message);
    } else if (isSigningUp && !result.data.session) {
      setMessage("Account created. Check your email to confirm, then sign in.");
    } else {
      setMessage(isSigningUp ? "Account created and signed in." : "Signed in.");
    }

    setLoading(false);
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    setMessage(error ? error.message : "Signed out.");
  }

  return (
    <main>
      <h1>Personalized Travel Itinerary Planner</h1>
      <p>Tell us how you like to travel, then generate a day-by-day itinerary.</p>

      <section className="auth-panel">
        {session ? (
          <>
            <p>Signed in as <strong>{session.user.email}</strong></p>
            <button type="button" onClick={handleSignOut}>Sign out</button>
          </>
        ) : (
          <form onSubmit={handleAuth}>
            <h2>{isSigningUp ? "Create account" : "Sign in"}</h2>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password (at least 6 characters)"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? "Please wait..." : isSigningUp ? "Sign up" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSigningUp(!isSigningUp);
                setMessage("");
              }}
            >
              {isSigningUp ? "Already have an account? Sign in" : "Create an account"}
            </button>
          </form>
        )}
        {message && <p role="status">{message}</p>}
      </section>

      <TripPreferenceForm user={session?.user ?? null} />
    </main>
  );
}

export default App;
