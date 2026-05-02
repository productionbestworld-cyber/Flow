import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://uexsgzexqoqpluiominb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVleHNnemV4cW9xcGx1aW9taW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTYwOTcsImV4cCI6MjA5MjkzMjA5N30.DltSnjAdPcEMB9VXQmwS0nFh7YifU-IX8jjY3yqAOW4'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
