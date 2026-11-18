-- Test-only seed: employer_admin + recruiter for JCMS role-purpose verification.
-- Password matches demo.student1 (Stud3nt!Lms#Demo1).

DO $$
DECLARE
  emp_org uuid := '01a162e1-891f-7108-823c-341d59a14b16';
  pwd text;
  ea_id uuid := '01a19f00-0001-7000-8000-000000000001';
  rec_id uuid := '01a19f00-0001-7000-8000-000000000002';
  ea_pid bigint := 379000000000000001;
  rec_pid bigint := 379000000000000002;
BEGIN
  SELECT password_hash INTO pwd FROM users WHERE email = 'demo.student1@example.com';

  INSERT INTO users (
    id, public_id, email, username, password_hash, first_name, last_name, role, status,
    institution_id, token_version, must_change_password, failed_login_attempts,
    email_verified_at, created_at, updated_at
  ) VALUES
  (ea_id, ea_pid, 'demo.employer1@example.com', 'demo.employer1', pwd, 'Demo', 'Employer', 'employer_admin', 'active',
   emp_org, 0, false, 0, now(), now(), now()),
  (rec_id, rec_pid, 'demo.recruiter1@example.com', 'demo.recruiter1', pwd, 'Demo', 'Recruiter', 'recruiter', 'active',
   emp_org, 0, false, 0, now(), now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO employment_profiles (user_id, employee_code, designation, department, created_at, updated_at)
  SELECT ea_id, 'EA-001', 'Hiring Manager', 'Talent', now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM employment_profiles WHERE user_id = ea_id);

  INSERT INTO employment_profiles (user_id, employee_code, designation, department, created_at, updated_at)
  SELECT rec_id, 'REC-001', 'Recruiter', 'Talent', now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM employment_profiles WHERE user_id = rec_id);
END $$;

SELECT email, role, public_id::text FROM users
WHERE email IN ('demo.employer1@example.com', 'demo.recruiter1@example.com');
