"""Campus placement demo jobs — descriptions paraphrased from public India career pages (2025–26 intake style)."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

# Shared eligibility for B.Tech campus drives in India.
DEFAULT_ELIGIBILITY: dict[str, Any] = {
    "programs": ["B.Tech CSE", "B.Tech IT", "B.Tech ECE", "B.Tech EEE"],
    "graduation_year_min": 2025,
    "graduation_year_max": 2027,
    "min_cgpa": 7.0,
    "required_skills": [],
    "max_backlogs": 0,
}

CAMPUS_DEMO_ORGS: list[dict[str, str]] = [
    {
        "name": "Tata Consultancy Services",
        "website": "https://www.tcs.com/careers",
        "industry": "IT Services",
    },
    {
        "name": "Infosys Limited",
        "website": "https://www.infosys.com/careers",
        "industry": "IT Services",
    },
    {
        "name": "Microsoft India",
        "website": "https://careers.microsoft.com",
        "industry": "Technology",
    },
    {
        "name": "Amazon Development Centre India",
        "website": "https://www.amazon.jobs",
        "industry": "Technology",
    },
    {
        "name": "Google India",
        "website": "https://careers.google.com",
        "industry": "Technology",
    },
]

CLOSES = (date.today() + timedelta(days=90)).isoformat()

CAMPUS_DEMO_JOBS: list[dict[str, Any]] = [
    {
        "org_name": "Tata Consultancy Services",
        "title": "NQT Digital — Systems Engineer",
        "location": "Hyderabad, Telangana, India",
        "employment_type": "FULL_TIME",
        "work_mode": "HYBRID",
        "salary_min": 360000,
        "salary_max": 440000,
        "openings": 25,
        "skills": ["Java", "Python", "SQL", "Problem solving"],
        "description": """Tata Consultancy Services hires engineering graduates through the National Qualifier Test (Digital) track for the Systems Engineer role.

About the role
You will work on design, development, and maintenance of applications for global clients across BFSI, retail, and technology verticals. The programme includes structured induction, agile delivery exposure, and continuous learning on TCS internal platforms.

What you will do
• Analyze requirements and translate them into technical designs
• Build and test application modules with code reviews and quality gates
• Collaborate with onshore teams across time zones
• Participate in DevOps and automation initiatives where applicable

What we look for
• B.E./B.Tech (CSE/IT/ECE/EEE) with consistent academic record
• Strong fundamentals in programming, data structures, and databases
• Willingness to travel or relocate based on project needs

Employment type: Full-time after campus onboarding. Compensation is inclusive of applicable allowances as per TCS campus policy.""",
        "eligibility": {**DEFAULT_ELIGIBILITY, "required_skills": ["Java", "Python"]},
    },
    {
        "org_name": "Infosys Limited",
        "title": "Systems Engineer Specialist — Campus Hire",
        "location": "Bengaluru, Karnataka, India",
        "employment_type": "FULL_TIME",
        "work_mode": "HYBRID",
        "salary_min": 400000,
        "salary_max": 520000,
        "openings": 20,
        "skills": ["Java", "Spring", "Angular", "Cloud fundamentals"],
        "description": """Infosys campus hiring for Systems Engineer Specialist prepares graduates for full-stack engineering on the Infosys Global Delivery Model.

Role overview
As a Systems Engineer Specialist you will engineer, test, and deploy software for Fortune 500 customers. You receive role-specific training on the Infosys Lex platform and continuous certification paths.

Responsibilities
• Develop maintainable code in agile squads with defined SLAs
• Participate in design discussions, unit testing, and CI/CD pipelines
• Support production incidents with root-cause analysis
• Engage with clients during demos and requirement workshops

Eligibility snapshot
• Engineering graduates (2025–2027) with minimum CGPA as per campus policy
• Comfort with at least one modern programming language
• Strong communication and teamwork

Work model: Hybrid with flexibility based on project and client location. Compensation band aligned with Infosys campus offer structure for the hiring season.""",
        "eligibility": {**DEFAULT_ELIGIBILITY, "required_skills": ["Java"]},
    },
    {
        "org_name": "Microsoft India",
        "title": "Software Engineer — University Graduate",
        "location": "Hyderabad, Telangana, India",
        "employment_type": "FULL_TIME",
        "work_mode": "HYBRID",
        "salary_min": 1800000,
        "salary_max": 2800000,
        "openings": 8,
        "skills": ["C#", "Azure", "Algorithms", "System design"],
        "description": """Microsoft's India university program hires engineers who will build products and services used by millions worldwide.

The opportunity
Software Engineers at Microsoft work across Azure, Microsoft 365, Windows, and AI platforms. You will ship customer-obsessed solutions while learning growth mindset practices and inclusive team culture.

You will
• Design, implement, and test features with accountability for quality and performance
• Partner with PM and design on scenarios spanning client, service, and cloud
• Participate in on-call rotations and live-site reviews after onboarding
• Contribute to technical decisions that improve developer velocity

Minimum qualifications
• Bachelor's in computer science or related field completing in the eligible graduation window
• Demonstrated project work in algorithms, systems, or application development
• Ability to work in English and collaborate across global teams

Microsoft offers competitive India graduate compensation, ESPP participation, learning benefits, and hybrid work options from India development centers.""",
        "eligibility": {**DEFAULT_ELIGIBILITY, "min_cgpa": 8.0, "required_skills": ["C#", "Algorithms"]},
    },
    {
        "org_name": "Amazon Development Centre India",
        "title": "Software Development Engineer Intern — 2026",
        "location": "Bengaluru, Karnataka, India",
        "employment_type": "INTERNSHIP",
        "work_mode": "HYBRID",
        "salary_min": 120000,
        "salary_max": 180000,
        "openings": 15,
        "skills": ["Java", "Python", "AWS", "Data structures"],
        "description": """Amazon's SDE internship in India places students on teams building retail, devices, and AWS services.

Internship experience
Interns own a project end-to-end with a mentor and bar-raiser feedback loop. You will write production-quality code, follow Amazon leadership principles, and present outcomes at intern demo days.

What to expect
• 8–12 week internship with pre-internship onboarding
• Real customer-facing or operational software—not toy exercises
• Weekly tech talks, leadership sessions, and return offer pipeline for strong performers

Basic requirements
• Pursuing B.Tech/M.Tech with CS or equivalent coursework
• Strong problem-solving and coding skills in at least one language
• Prior internship or substantial project experience is a plus

Intern stipend and benefits are published in the campus offer letter. Successful interns may receive full-time return offers subject to business need.""",
        "eligibility": {
            **DEFAULT_ELIGIBILITY,
            "graduation_year_min": 2026,
            "graduation_year_max": 2027,
            "required_skills": ["Python", "Data structures"],
        },
    },
    {
        "org_name": "Google India",
        "title": "Software Engineer — University Graduate (India)",
        "location": "Bengaluru, Karnataka, India",
        "employment_type": "FULL_TIME",
        "work_mode": "HYBRID",
        "salary_min": 2000000,
        "salary_max": 3200000,
        "openings": 6,
        "skills": ["C++", "Python", "Distributed systems", "Algorithms"],
        "description": """Google's university graduate engineering roles in India focus on scalable systems that power Search, Ads, Cloud, and Android.

Role summary
Software Engineers at Google solve novel problems at scale. New grads rotate through codebases with mentorship, code readability standards, and data-driven launch processes.

Responsibilities
• Develop software components with tests, monitoring, and rollout plans
• Review code and design docs with peers across offices
• Optimize latency, reliability, and cost for internet-scale workloads
• Learn Google's engineering practices through Tech Dev and peer matching

Qualifications
• Bachelor's in computer science or equivalent practical experience
• Coding proficiency and solid CS fundamentals (algorithms, complexity, OS)
• Interest in building accessible, secure, and performant products

Google India offers competitive packages, wellness benefits, and hybrid schedules from Bengaluru and Hyderabad offices.""",
        "eligibility": {**DEFAULT_ELIGIBILITY, "min_cgpa": 8.5, "required_skills": ["Python", "Algorithms"]},
    },
]