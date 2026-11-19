import { useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  Award,
  Clock3,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { useListMyCoursesQuery } from "@/modules/learning/common/api/myCoursesApi";

export function StudentDashboardView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: myCourses } = useListMyCoursesQuery();

  const firstName = useMemo(() => {
    if (!user?.full_name) return "Learner";
    return user.full_name.split(" ")[0];
  }, [user]);

  const timeOfDay = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
  }, []);

  const todayFormatted = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).toUpperCase();
  }, []);

  const activeCourse = useMemo(() => {
    const first = myCourses?.[0];
    if (first) {
      return {
        course_id: first.course_id,
        title: first.title,
        progress: 100,
        module_title: "Module 3 · Functions & Modules",
      };
    }
    return {
      course_id: "376947952244952473",
      title: "Python Programming & Clean Architecture",
      progress: 100,
      module_title: "Module 3 · Functions & Modules",
    };
  }, [myCourses]);

  const overallProgress = 100;

  const weekActivity = [
    { day: "M", height: 48 },
    { day: "T", height: 75 },
    { day: "W", height: 35 },
    { day: "T", height: 88 },
    { day: "F", height: 60 },
    { day: "S", height: 20 },
    { day: "S", height: 12 },
  ];

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto pb-12">
      {/* 1. Welcome Row with Eyebrow, Greeting & Pill */}
      <div className="welcome-row">
        <div>
          <div className="eyebrow">{todayFormatted}</div>
          <h1>
            Good {timeOfDay}, {firstName} <span>✦</span>
          </h1>
          <p className="muted">
            Keep building your skills. Your next opportunity is closer than you think.
          </p>
        </div>
        <div className="welcome-pill">
          <Sparkles size={16} /> Your learning journey
        </div>
      </div>

      {/* 2. Indigo Gradient Hero Panel with Circular Ripples & Floating Art Card */}
      <section className="hero-panel">
        <div>
          <span className="hero-kicker">YOUR NEXT CHAPTER STARTS HERE</span>
          <h2>
            Learn something new.<br />
            <em>Become something more.</em>
          </h2>
          <p>
            Explore expert-led courses, discover career opportunities and build a portfolio that gets noticed.
          </p>
          <div className="hero-actions">
            <Link
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-white text-[#4f46dc] hover:bg-slate-50 transition shadow-xs cursor-pointer"
              to="/browse-courses"
            >
              <span>Explore courses</span> <ArrowUpRight size={15} />
            </Link>
            <Link
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-white/15 text-white border border-white/30 hover:bg-white/25 transition cursor-pointer"
              to="/courses/my"
            >
              <span>My courses</span>
            </Link>
          </div>
        </div>

        <div className="hero-art">
          <div className="art-circle">✦</div>
          <div className="art-card">
            <BookOpen size={34} />
            <b>Keep growing</b>
            <small>One lesson at a time</small>
            <div className="art-progress">
              <i style={{ width: `${overallProgress}%` }} />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Your Workspace Header */}
      <div className="section-head">
        <div>
          <h2>Your workspace</h2>
          <p className="muted">Pick up where you left off</p>
        </div>
      </div>

      {/* 4. Quick Grid 3-Cards */}
      <div className="quick-grid">
        <Link to="/browse-courses" className="quick-card">
          <div className="quick-icon violet">
            <BookOpen size={20} />
          </div>
          <div>
            <b>Explore courses</b>
            <p>Discover skills and courses</p>
          </div>
          <ArrowUpRight />
        </Link>

        <Link to="/courses/my" className="quick-card">
          <div className="quick-icon blue">
            <BriefcaseBusiness size={20} />
          </div>
          <div>
            <b>My Enrolled Courses</b>
            <p>Track active courses and curriculum</p>
          </div>
          <ArrowUpRight />
        </Link>

        <Link to="/certificates" className="quick-card">
          <div className="quick-icon peach">
            <Award size={20} />
          </div>
          <div>
            <b>Assessments & Certificates</b>
            <p>View verified credentials & test scores</p>
          </div>
          <ArrowUpRight />
        </Link>
      </div>

      {/* 5. Bottom Grid (Learning Progress + Continue Learning) */}
      <div className="bottom-grid">
        {/* Left Panel: Activity & Progress */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Learning progress</h3>
              <p className="muted">Your activity this week</p>
            </div>
            <span className="soft-tag">This week</span>
          </div>

          <div className="progress-summary">
            <div>
              <strong>{overallProgress}%</strong>
              <small>Overall progress</small>
            </div>
            <div className="progress-track">
              <i style={{ width: `${overallProgress}%` }} />
            </div>
          </div>

          <div className="week-bars">
            {weekActivity.map((w, idx) => (
              <div key={idx}>
                <span style={{ height: `${w.height}%` }} />
                <small>{w.day}</small>
              </div>
            ))}
          </div>
        </section>

        {/* Right Panel: Continue Learning */}
        <section className="panel flex flex-col justify-between">
          <div>
            <div className="panel-head">
              <div>
                <h3>Continue learning</h3>
                <p className="muted">A little progress goes a long way</p>
              </div>
              <Clock3 size={18} className="muted" />
            </div>

            <div className="continue-row">
              <div className="course-thumb blue">⚛</div>
              <div className="continue-info">
                <b>{activeCourse.title}</b>
                <small>
                  {activeCourse.module_title} ·{" "}
                  {activeCourse.progress === 100 ? "Completed" : `${activeCourse.progress}% done`}
                </small>
                <div className="progress-track">
                  <i style={{ width: `${activeCourse.progress}%` }} />
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  navigate(`/courses/${activeCourse.course_id}/learn`)
                }
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#635bff] hover:bg-[#5148e8] text-white text-xs font-bold shadow-xs cursor-pointer transition shrink-0"
              >
                Continue
              </button>
            </div>
          </div>

          {/* Quick exam reminder if student has upcoming assessment */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 size={14} className="text-emerald-600" />
              Final assessment ready
            </span>
            <Link
              to={`/courses/${activeCourse.course_id}/learn`}
              className="text-[#635BFF] font-bold hover:underline"
            >
              Take Assessment →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
