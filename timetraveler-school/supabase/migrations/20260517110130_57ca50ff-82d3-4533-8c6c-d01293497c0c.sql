
-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'principal', 'scheduler', 'teacher');
CREATE TYPE public.education_stage AS ENUM ('primary', 'preparatory', 'secondary');
CREATE TYPE public.classroom_type AS ENUM ('classroom', 'lab', 'gym', 'workshop', 'library', 'other');
CREATE TYPE public.entity_status AS ENUM ('active', 'inactive');
CREATE TYPE public.day_of_week AS ENUM ('sunday','monday','tuesday','wednesday','thursday','friday','saturday');
CREATE TYPE public.constraint_priority AS ENUM ('low','medium','high','must');

-- ============================================================
-- updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============================================================
-- Schools
-- ============================================================
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  logo_url TEXT,
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_schools_updated BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Profiles
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_school ON public.profiles(school_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- User roles (separate table - critical security)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, school_id, role)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- Security definer functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.get_user_school(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT school_id FROM public.profiles WHERE id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_school_manager(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
      AND role IN ('admin','principal','scheduler')
  );
$$;

-- ============================================================
-- Teachers
-- ============================================================
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID,
  employee_no TEXT,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  specialization TEXT,
  max_daily_lessons INT NOT NULL DEFAULT 6,
  max_weekly_lessons INT NOT NULL DEFAULT 24,
  working_days public.day_of_week[] NOT NULL DEFAULT ARRAY['sunday','monday','tuesday','wednesday','thursday']::public.day_of_week[],
  avatar_url TEXT,
  status public.entity_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id, employee_no)
);
CREATE INDEX idx_teachers_school ON public.teachers(school_id);
CREATE TRIGGER trg_teachers_updated BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Subjects
-- ============================================================
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  weekly_lessons INT NOT NULL DEFAULT 1 CHECK (weekly_lessons > 0),
  stage public.education_stage,
  needs_lab BOOLEAN NOT NULL DEFAULT false,
  double_period BOOLEAN NOT NULL DEFAULT false,
  is_core BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id, code)
);
CREATE INDEX idx_subjects_school ON public.subjects(school_id);
CREATE TRIGGER trg_subjects_updated BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Classes
-- ============================================================
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stage public.education_stage NOT NULL DEFAULT 'primary',
  grade_level INT,
  students_count INT NOT NULL DEFAULT 30,
  daily_lessons INT NOT NULL DEFAULT 7,
  home_classroom_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id, name)
);
CREATE INDEX idx_classes_school ON public.classes(school_id);
CREATE TRIGGER trg_classes_updated BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Classrooms
-- ============================================================
CREATE TABLE public.classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.classroom_type NOT NULL DEFAULT 'classroom',
  capacity INT NOT NULL DEFAULT 30,
  equipment TEXT[],
  status public.entity_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id, name)
);
CREATE INDEX idx_classrooms_school ON public.classrooms(school_id);
CREATE TRIGGER trg_classrooms_updated BEFORE UPDATE ON public.classrooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.classes ADD CONSTRAINT classes_home_classroom_fk FOREIGN KEY (home_classroom_id) REFERENCES public.classrooms(id) ON DELETE SET NULL;

-- ============================================================
-- Teacher-Subjects link
-- ============================================================
CREATE TABLE public.teacher_subjects (
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, subject_id)
);

-- ============================================================
-- Class-Subject requirements (the "lessons" definition)
-- ============================================================
CREATE TABLE public.class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  weekly_count INT NOT NULL DEFAULT 1 CHECK (weekly_count > 0),
  double_period BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, subject_id)
);
CREATE INDEX idx_class_subjects_school ON public.class_subjects(school_id);

-- ============================================================
-- Teacher unavailability
-- ============================================================
CREATE TABLE public.teacher_unavailability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  day public.day_of_week NOT NULL,
  period_no INT NOT NULL CHECK (period_no >= 1),
  reason TEXT,
  UNIQUE(teacher_id, day, period_no)
);

-- ============================================================
-- Schedule entries
-- ============================================================
CREATE TABLE public.schedule_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
  day public.day_of_week NOT NULL,
  period_no INT NOT NULL CHECK (period_no >= 1),
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, day, period_no)
);
CREATE INDEX idx_schedule_school ON public.schedule_entries(school_id);
CREATE INDEX idx_schedule_teacher_day ON public.schedule_entries(teacher_id, day, period_no);
CREATE INDEX idx_schedule_room_day ON public.schedule_entries(classroom_id, day, period_no);
CREATE TRIGGER trg_schedule_updated BEFORE UPDATE ON public.schedule_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Substitutions
-- ============================================================
CREATE TABLE public.substitutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  absence_date DATE NOT NULL,
  schedule_entry_id UUID NOT NULL REFERENCES public.schedule_entries(id) ON DELETE CASCADE,
  original_teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  substitute_teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(schedule_entry_id, absence_date)
);
CREATE INDEX idx_subs_school_date ON public.substitutions(school_id, absence_date);

-- ============================================================
-- Constraints
-- ============================================================
CREATE TABLE public.scheduling_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority public.constraint_priority NOT NULL DEFAULT 'medium',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_constraints_school ON public.scheduling_constraints(school_id);

-- ============================================================
-- Notifications
-- ============================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, read_at);

-- ============================================================
-- Audit logs
-- ============================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  school_id UUID,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_school ON public.audit_logs(school_id, created_at DESC);

-- ============================================================
-- School settings
-- ============================================================
CREATE TABLE public.school_settings (
  school_id UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  working_days public.day_of_week[] NOT NULL DEFAULT ARRAY['sunday','monday','tuesday','wednesday','thursday']::public.day_of_week[],
  periods_per_day INT NOT NULL DEFAULT 7 CHECK (periods_per_day BETWEEN 1 AND 12),
  period_duration_min INT NOT NULL DEFAULT 45,
  first_period_start TIME NOT NULL DEFAULT '08:00',
  break_after_period INT,
  break_duration_min INT NOT NULL DEFAULT 15,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_school_settings_updated BEFORE UPDATE ON public.school_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_unavailability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.substitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduling_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies
-- ============================================================

-- profiles: user sees self; managers see their school members
CREATE POLICY "profiles_select_self_or_school" ON public.profiles FOR SELECT
USING (id = auth.uid() OR school_id = public.get_user_school(auth.uid()));
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- schools
CREATE POLICY "schools_select_member" ON public.schools FOR SELECT
USING (id = public.get_user_school(auth.uid()) OR owner_id = auth.uid());
CREATE POLICY "schools_insert_auth" ON public.schools FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "schools_update_manager" ON public.schools FOR UPDATE
USING (public.is_school_manager(auth.uid(), id));
CREATE POLICY "schools_delete_owner" ON public.schools FOR DELETE USING (owner_id = auth.uid());

-- user_roles
CREATE POLICY "roles_select_self_or_manager" ON public.user_roles FOR SELECT
USING (user_id = auth.uid() OR public.is_school_manager(auth.uid(), school_id));
CREATE POLICY "roles_insert_manager_or_self_initial" ON public.user_roles FOR INSERT
WITH CHECK (
  public.is_school_manager(auth.uid(), school_id)
  OR (user_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE school_id = user_roles.school_id))
);
CREATE POLICY "roles_update_manager" ON public.user_roles FOR UPDATE
USING (public.is_school_manager(auth.uid(), school_id));
CREATE POLICY "roles_delete_manager" ON public.user_roles FOR DELETE
USING (public.is_school_manager(auth.uid(), school_id));

-- Generic per-school policies via a macro pattern using DO block
-- teachers/subjects/classes/classrooms/class_subjects/schedule_entries/substitutions/constraints/school_settings
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['teachers','subjects','classes','classrooms','class_subjects','schedule_entries','substitutions','scheduling_constraints']
  LOOP
    EXECUTE format('CREATE POLICY "%s_select_school" ON public.%I FOR SELECT USING (school_id = public.get_user_school(auth.uid()))', t, t);
    EXECUTE format('CREATE POLICY "%s_modify_manager" ON public.%I FOR ALL USING (public.is_school_manager(auth.uid(), school_id)) WITH CHECK (public.is_school_manager(auth.uid(), school_id))', t, t);
  END LOOP;
END $$;

-- teacher_subjects (no school_id; derive via teacher)
CREATE POLICY "ts_select_school" ON public.teacher_subjects FOR SELECT
USING (EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND t.school_id = public.get_user_school(auth.uid())));
CREATE POLICY "ts_modify_manager" ON public.teacher_subjects FOR ALL
USING (EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND public.is_school_manager(auth.uid(), t.school_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND public.is_school_manager(auth.uid(), t.school_id)));

-- teacher_unavailability
CREATE POLICY "tu_select_school" ON public.teacher_unavailability FOR SELECT
USING (EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND t.school_id = public.get_user_school(auth.uid())));
CREATE POLICY "tu_modify_manager" ON public.teacher_unavailability FOR ALL
USING (EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND public.is_school_manager(auth.uid(), t.school_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND public.is_school_manager(auth.uid(), t.school_id)));

-- school_settings
CREATE POLICY "ss_select_school" ON public.school_settings FOR SELECT
USING (school_id = public.get_user_school(auth.uid()));
CREATE POLICY "ss_modify_manager" ON public.school_settings FOR ALL
USING (public.is_school_manager(auth.uid(), school_id))
WITH CHECK (public.is_school_manager(auth.uid(), school_id));

-- notifications
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notif_insert_managers" ON public.notifications FOR INSERT
WITH CHECK (public.is_school_manager(auth.uid(), school_id) OR user_id = auth.uid());
CREATE POLICY "notif_delete_own" ON public.notifications FOR DELETE USING (user_id = auth.uid());

-- audit_logs
CREATE POLICY "audit_select_manager" ON public.audit_logs FOR SELECT
USING (public.is_school_manager(auth.uid(), school_id));
CREATE POLICY "audit_insert_auth" ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- Auto-create profile, school, and admin role on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school_id UUID;
  v_school_name TEXT;
BEGIN
  v_school_name := COALESCE(NEW.raw_user_meta_data->>'school_name', 'مدرستي');

  -- create school
  INSERT INTO public.schools (name, owner_id) VALUES (v_school_name, NEW.id) RETURNING id INTO v_school_id;

  -- default settings
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id);

  -- profile
  INSERT INTO public.profiles (id, school_id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    v_school_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- admin role
  INSERT INTO public.user_roles (user_id, school_id, role) VALUES (NEW.id, v_school_id, 'admin');

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Enable realtime
-- ============================================================
ALTER TABLE public.schedule_entries REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.substitutions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.substitutions;
