ALTER TABLE public.meeting_minutes ADD COLUMN next_meeting_date DATE;
ALTER TABLE public.meeting_minutes ADD COLUMN attachments_summary TEXT;

-- Refresh permissions
GRANT ALL ON public.meeting_minutes TO authenticated;
GRANT ALL ON public.meeting_minutes TO service_role;