// Diese Werte sind bewusst öffentlich (publishable anon key, durch Row Level
// Security abgesichert) – als Fallback hier hinterlegt, damit die App auch
// läuft, wenn auf der Hosting-Plattform (noch) keine Env-Vars gesetzt wurden.
// Für Produktion trotzdem empfohlen: NEXT_PUBLIC_SUPABASE_URL /
// NEXT_PUBLIC_SUPABASE_ANON_KEY als Env-Vars setzen, das überschreibt diese Defaults.

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://ihnlogpgpeddgxzdptkc.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlobmxvZ3BncGVkZGd4emRwdGtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwOTY4OTYsImV4cCI6MjEwMDY3Mjg5Nn0.7jrnw22XgRurOUPE3n0peH9Sn9HBEpXFKsr-ka9zDS4";
