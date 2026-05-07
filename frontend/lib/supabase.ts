import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://sfpiezwgaeyclvsnuoxr.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcGllendnYWV5Y2x2c251b3hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDc1MjYsImV4cCI6MjA5MzYyMzUyNn0.MJASXM8s5Z_4uw0HPN69Is4vIBZ1Lq1u-2h1R7dNO5Q";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
