"""The products the marketplace starts with. Loaded once into an empty catalogue; after that super admins own it
(add products and plans, change prices) and this file is never applied again."""

from decimal import Decimal
from typing import Any

D = Decimal

DEFAULT_PRODUCTS: list[dict[str, Any]] = [
    {
        "key": "lms", "name": "LMS", "icon": "graduation", "tagline": "Courses, tests and certificates",
        "description": "Structured courses with video and PDF lessons, chapter and module tests, a proctored final exam and verifiable certificates.",
        "features": ["Video and PDF lessons", "Chapter, module and final tests", "Progress tracking", "Verifiable certificates"],
        "modules": [
            {"key": "web", "name": "Web Development", "monthly_price": "6"},
            {"key": "data", "name": "Data Science", "monthly_price": "8"},
            {"key": "dsa", "name": "Data Structures and Algorithms", "monthly_price": "7"},
        ],
        "plans": [
            {"key": "basic", "name": "Basic", "monthly_price": D("9"), "seat_price": D("3"), "limits": [{"label": "Courses", "value": "Up to 3"}]},
            {"key": "standard", "name": "Standard", "monthly_price": D("19"), "seat_price": D("5"), "highlight": True, "limits": [{"label": "Courses", "value": "Up to 10"}]},
            {"key": "unlimited", "name": "Unlimited", "monthly_price": D("39"), "seat_price": D("8"), "limits": [{"label": "Courses", "value": "All"}]},
        ],
    },
    {
        "key": "resume", "name": "AI Resume Builder", "icon": "fileText", "tagline": "Resumes written and polished with AI",
        "description": "Build ATS-friendly resumes from your details, improve wording with AI, keep several versions and download them as PDF.",
        "features": ["Templates for every career stage", "AI summary and bullet rewriting", "ATS keyword check", "Multiple saved versions"],
        "modules": [],
        "plans": [
            {"key": "basic", "name": "Basic", "monthly_price": D("5"), "seat_price": D("2"), "limits": [{"label": "AI resumes a month", "value": "5"}, {"label": "Saved versions", "value": "3"}]},
            {"key": "premium", "name": "Premium", "monthly_price": D("12"), "seat_price": D("4"), "highlight": True, "limits": [{"label": "AI resumes a month", "value": "50"}, {"label": "Saved versions", "value": "Unlimited"}]},
        ],
    },
    {
        "key": "jobs", "name": "AI Job Portal", "icon": "briefcase", "tagline": "Find and track the right jobs",
        "description": "Search jobs, see an AI match score against your profile, apply in one place and follow every application.",
        "features": ["AI job matching", "Recommended jobs", "Application tracking", "Saved jobs and alerts"],
        "modules": [],
        "plans": [
            {"key": "standard", "name": "Standard", "monthly_price": D("7"), "seat_price": D("3"), "highlight": True, "limits": [{"label": "Applications a month", "value": "30"}, {"label": "Job alerts", "value": "10"}]},
            {"key": "pro", "name": "Pro", "monthly_price": D("15"), "seat_price": D("5"), "limits": [{"label": "Applications a month", "value": "Unlimited"}, {"label": "Job alerts", "value": "Unlimited"}]},
        ],
    },
    {
        "key": "interview", "name": "AI Interview Preparation", "icon": "mic", "tagline": "Practice interviews with feedback",
        "description": "Mock interviews by role and difficulty, with AI feedback on communication, knowledge and confidence, and a report after each one.",
        "features": ["Technical, HR and behavioural rounds", "Scored AI feedback", "Suggested better answers", "Practice history"],
        "modules": [],
        "plans": [
            {"key": "basic", "name": "Basic", "monthly_price": D("6"), "seat_price": D("2"), "limits": [{"label": "Mock interviews a month", "value": "5"}]},
            {"key": "advanced", "name": "Advanced", "monthly_price": D("14"), "seat_price": D("4"), "highlight": True, "limits": [{"label": "Mock interviews a month", "value": "30"}]},
        ],
    },
]
