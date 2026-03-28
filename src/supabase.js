import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ojszfdtusmeneolowtix.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qc3pmZHR1c21lbmVvbG93dGl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjM1OTMsImV4cCI6MjA5MDIzOTU5M30.0CpgsIKEH9VwSdQ_UJeBbEU-qs_GeRxzd-DocwF1LWM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
