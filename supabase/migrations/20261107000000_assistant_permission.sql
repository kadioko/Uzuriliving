-- Preserve existing report-enabled staff access while allowing owners to
-- independently enable or revoke assistant access for each staff member.
ALTER TABLE public.staff_members
  ADD COLUMN "canUseAssistant" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.staff_members
SET "canUseAssistant" = "canViewReports";
