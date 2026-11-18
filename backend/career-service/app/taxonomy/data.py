"""The starting catalogue of fields of work, departments and roles, with what each one says about its resumes.

This is only seed data: careers managers add and change industries, departments, roles, skills and keywords through
the /admin/taxonomy API, and nothing in the product depends on this list being complete. A role that is not here still
works: the person types it, and the department (or a generic professional layout) supplies the guidance.
Each department states its own skills, ATS keywords, headings and extra sections; a role may override any of them.
"""

from typing import Any

CAREER_LEVELS: list[tuple[str, str, str, str]] = [
    ("student", "Student", "fresher", "Skills, projects and coursework lead; one page."),
    ("intern", "Intern", "fresher", "Internships count as experience."),
    ("fresher", "Fresher", "fresher", "A recent graduate: education, skills and projects first."),
    ("entry", "Entry level", "junior", "Up to about a year of work."),
    ("junior", "Junior professional", "junior", "1 to 3 years: experience first."),
    ("mid", "Mid-level professional", "mid", "3 to 8 years: results in numbers."),
    ("senior", "Senior professional", "senior", "8 or more years: leadership and impact."),
    ("lead", "Team lead", "senior", "People and delivery lead the page."),
    ("manager", "Manager", "senior", "Scope, teams and results."),
    ("director", "Director", "senior", "Strategy and organisation-wide outcomes."),
    ("executive", "Executive / C-level", "senior", "Vision, P&L and governance."),
    ("freelancer", "Freelancer", "mid", "Clients, projects and results."),
    ("consultant", "Consultant", "senior", "Engagements, sectors and outcomes."),
    ("switcher", "Career switcher", "junior", "Transferable skills and recent learning lead."),
    ("returning", "Returning professional", "mid", "Past experience plus what you have done since."),
]

PURPOSES: list[tuple[str, str, str, list[str]]] = [
    ("job", "Job application", "A resume aimed at one role.", ["experience", "skills"]),
    ("internship", "Internship application", "Education, projects and skills first.", ["education", "projects", "skills"]),
    ("career_change", "Career change", "Transferable skills first.", ["skills", "experience"]),
    ("promotion", "Promotion", "Results and scope in your current organisation.", ["experience", "achievements"]),
    ("freelance", "Freelance opportunities", "Clients, projects and results.", ["projects", "experience"]),
    ("academic", "Academic application", "Research, teaching and publications.", ["education", "achievements"]),
    ("government", "Government job application", "Qualifications and service details in full.", ["education", "experience"]),
    ("profile", "General professional profile", "A balanced all-round resume.", ["experience", "education"]),
]

_LABELS = {"experience": "Work Experience", "projects": "Projects", "skills": "Skills", "education": "Education", "achievements": "Achievements"}


def _sec(experience: str = "Work Experience", projects: str = "Projects", skills: str = "Skills", achievements: str = "Achievements", groups: list[str] | None = None, extra: list[dict[str, str]] | None = None, projects_step: bool = False) -> dict[str, Any]:
    return {
        "labels": {**_LABELS, "experience": experience, "projects": projects, "skills": skills, "achievements": achievements},
        "skill_groups": groups or ["Core skills", "Tools", "Soft skills"],
        "extra_sections": extra or [],  # {"label", "hint"}: stored as achievements under this heading
        "projects_step": projects_step,
    }


def _dept(key: str, name: str, roles: list[Any], skills: list[str], keywords: list[str], sections: dict[str, Any], templates: list[str], hint: str) -> dict[str, Any]:
    return {"key": key, "name": name, "roles": roles, "skills": skills, "keywords": keywords, "sections": sections, "templates": templates, "hint": hint}


def role(name: str, **overrides: Any) -> dict[str, Any]:
    return {"name": name, **overrides}


_SOFT = ["Communication", "Teamwork", "Problem solving", "Time management"]

INDUSTRIES: list[dict[str, Any]] = [
    {"key": "it", "name": "Information Technology & Software", "icon": "code", "departments": [
        _dept("it-software", "Software Development", [
            role("Frontend Developer", skills=["React", "TypeScript", "JavaScript", "HTML", "CSS", "Tailwind CSS", "REST APIs", "Git", "Performance Optimization", "Responsive Design"], keywords=["react", "typescript", "javascript", "css", "responsive", "accessibility", "rest api", "git", "ui"], aliases=["Front-end Developer", "UI Developer"], specializations=["React", "Angular", "Vue"]),
            role("Backend Developer", skills=["Python", "Java", "Node.js", "REST APIs", "SQL", "PostgreSQL", "Docker", "Git", "System Design", "Testing"], keywords=["api", "python", "java", "sql", "microservices", "docker", "database", "scalable", "testing"], aliases=["Back-end Developer"]),
            "Full Stack Developer", "Software Engineer", "Python Developer", "Java Developer", "React Developer", "Mobile App Developer", "Blockchain Developer", "Technical Architect"],
              ["Programming languages", "Frameworks", "Databases", "Tools"], ["api", "git", "agile", "testing", "database", "cloud", "ci/cd", "sql"], _sec(experience="Professional Experience", projects="Software Projects", skills="Technical Skills", achievements="Certifications & Achievements", groups=["Programming languages", "Frameworks", "Databases", "Tools"], projects_step=True), ["technical", "modern"], "Use software engineering terms: systems, APIs, frameworks, deployments."),
        _dept("it-infra", "DevOps, Cloud & Infrastructure", ["DevOps Engineer", "Cloud Engineer", "Network Engineer", "Database Administrator", "System Administrator", "IT Support Engineer"],
              ["Linux", "AWS", "Docker", "Kubernetes", "CI/CD", "Terraform", "Networking", "Monitoring", "Scripting", "Security basics"], ["aws", "docker", "kubernetes", "ci/cd", "linux", "infrastructure", "monitoring", "automation"], _sec(experience="Professional Experience", skills="Technical Skills", groups=["Platforms & cloud", "Tools", "Scripting & automation"], projects_step=True), ["technical", "professional"], "Use infrastructure and operations terms: uptime, deployments, automation."),
        _dept("it-data", "Data, AI & Machine Learning", ["Data Analyst", "Data Scientist", "Machine Learning Engineer", "AI Engineer", "AI/ML Researcher"],
              ["Python", "SQL", "Statistics", "Machine learning", "Pandas", "Data visualisation", "Power BI", "TensorFlow", "Excel", "A/B testing"], ["python", "sql", "machine learning", "statistics", "model", "dashboard", "etl", "analysis"], _sec(experience="Professional Experience", projects="Data Projects", skills="Technical Skills", groups=["Languages", "Libraries & frameworks", "Tools"], projects_step=True), ["technical", "modern"], "Use data and modelling terms: datasets, models, accuracy, insights."),
        _dept("it-quality-security", "Quality & Cybersecurity", ["QA Engineer", "Automation Tester", "Cybersecurity Analyst"],
              ["Test planning", "Selenium", "API testing", "Bug tracking", "Network security", "SIEM", "Vulnerability assessment", "Python", "Git"], ["testing", "automation", "selenium", "security", "vulnerability", "risk", "compliance"], _sec(experience="Professional Experience", skills="Technical Skills", groups=["Testing & security", "Tools"], projects_step=True), ["technical", "professional"], "Use testing and security terms: coverage, defects, threats, controls."),
    ]},
    {"key": "hr", "name": "Human Resources & Administration", "icon": "users", "departments": [
        _dept("hr-core", "Human Resources", [
            role("HR Manager", skills=["Recruitment", "Talent Management", "Employee Engagement", "HR Operations", "Payroll", "Performance Management", "HR Policies", "Employee Relations", "HR Analytics"], keywords=["recruitment", "talent management", "employee engagement", "hr operations", "payroll", "performance management", "hr policies", "employee relations", "hris"]),
            "HR Executive", "HR Business Partner", "Talent Acquisition Specialist", "Recruitment Consultant", "HR Generalist", "Payroll Specialist", "Training & Development Manager", "Employee Relations Specialist"],
              ["Recruitment", "Onboarding", "Payroll", "Employee relations", "HRIS", "Labour law", "Performance management", "Engagement"], ["recruitment", "onboarding", "payroll", "hris", "employee", "compliance", "retention", "policy"], _sec(experience="HR Experience", achievements="Recruitment & HR Achievements", skills="HR Skills", groups=["HR functions", "HR systems", "Soft skills"], extra=[{"label": "Professional memberships", "hint": "SHRM, NIPM or similar, if you hold them"}]), ["professional", "classic"], "Use HR terms: hiring, retention, policies, employee lifecycle. No software terminology."),
        _dept("admin-office", "Administration", ["Administration Executive", "Office Manager"], ["MS Office", "Scheduling", "Record keeping", "Vendor coordination", "Reception", "Documentation", "Budget tracking", "Communication"], ["administration", "scheduling", "coordination", "documentation", "vendor", "office management"], _sec(experience="Administrative Experience"), ["classic", "minimal"], "Use office administration terms: coordination, records, scheduling, vendors."),
    ]},
    {"key": "finance", "name": "Finance, Accounting & Banking", "icon": "wallet", "departments": [
        _dept("finance-accounting", "Accounting & Audit", [
            role("Accountant", skills=["Financial Reporting", "General Ledger", "Accounts Payable", "Accounts Receivable", "Taxation", "GST", "Tally", "Excel", "Reconciliation", "Auditing"], keywords=["financial reporting", "general ledger", "accounts payable", "accounts receivable", "taxation", "gst", "tally", "reconciliation", "audit", "month-end close"]),
            "Senior Accountant", "Auditor", "Tax Consultant", "Chartered Accountant", "Cost Accountant", "Financial Controller"],
              ["Financial Reporting", "Bookkeeping", "Taxation", "Audit", "Reconciliation", "Tally", "SAP", "Excel"], ["financial reporting", "ledger", "audit", "tax", "reconciliation", "gst", "compliance", "budget"], _sec(experience="Accounting Experience", skills="Accounting Skills", achievements="Relevant Achievements", groups=["Accounting & finance", "Software & systems", "Regulatory knowledge"], extra=[{"label": "Professional qualifications", "hint": "CA, CMA, ACCA, CPA: only ones you hold"}]), ["professional", "classic"], "Use accounting terms: ledgers, reconciliations, statutory compliance. No software-engineering terms."),
        _dept("finance-banking", "Banking, Investment & Risk", ["Financial Analyst", "Finance Manager", "Investment Analyst", "Banking Executive", "Credit Analyst", "Risk Analyst"],
              ["Financial modelling", "Valuation", "Credit analysis", "Risk assessment", "Excel", "Bloomberg", "Forecasting", "KYC", "Portfolio analysis"], ["financial modelling", "valuation", "credit", "risk", "portfolio", "forecast", "kyc", "compliance"], _sec(experience="Finance Experience", skills="Finance Skills", groups=["Analysis & modelling", "Systems", "Regulatory knowledge"]), ["professional", "modern"], "Use finance terms: models, forecasts, exposure, returns, controls."),
    ]},
    {"key": "sales-marketing", "name": "Sales, Marketing & Business Development", "icon": "megaphone", "departments": [
        _dept("sales", "Sales & Business Development", [
            role("Sales Executive", skills=["Lead Generation", "Cold Calling", "Negotiation", "CRM", "Client Relationship", "Sales Targets", "Pipeline Management", "Closing", "Territory Management"], keywords=["sales targets", "revenue", "lead generation", "crm", "client acquisition", "conversion", "pipeline", "negotiation"]),
            "Sales Manager", "Business Development Executive", "Business Development Manager", "Account Manager"],
              ["Lead generation", "Negotiation", "CRM", "Account management", "Forecasting", "Presentations"], ["revenue", "quota", "pipeline", "crm", "clients", "conversion", "negotiation"], _sec(experience="Sales Experience", skills="Sales Skills", achievements="Sales Achievements", groups=["Sales skills", "Tools & CRM"], extra=[{"label": "Awards & recognition", "hint": "Top performer, quota awards"}]), ["modern", "professional"], "Use sales terms: targets, revenue, conversion, clients. Numbers the person gave matter most."),
        _dept("marketing", "Marketing", [
            role("Digital Marketing Manager", skills=["SEO", "SEM", "Google Analytics", "Social Media Marketing", "Email Marketing", "Content Strategy", "Campaign Management", "Marketing Analytics", "Budget Management"], keywords=["seo", "sem", "campaign", "analytics", "roi", "conversion", "content strategy", "social media", "lead generation"]),
            "Digital Marketing Executive", "SEO Specialist", "Social Media Manager", "Content Marketing Specialist", "Brand Manager", "Marketing Analyst", "Performance Marketing Specialist", "Growth Manager"],
              ["SEO", "Content strategy", "Social media", "Google Analytics", "Campaign management", "Email marketing"], ["campaign", "seo", "analytics", "engagement", "roi", "brand", "content", "conversion"], _sec(experience="Marketing Experience", projects="Campaigns", skills="Marketing Skills", groups=["Channels", "Tools & analytics"], projects_step=True), ["modern", "creative"], "Use marketing terms: campaigns, channels, reach, conversion. No software-development terms."),
    ]},
    {"key": "engineering", "name": "Engineering & Technical", "icon": "cog", "departments": [
        _dept("engineering-core", "Engineering", [
            role("Mechanical Engineer", skills=["AutoCAD", "SolidWorks", "Manufacturing Processes", "Product Design", "Quality Control", "Mechanical Systems", "Maintenance", "Engineering Analysis"], keywords=["autocad", "solidworks", "manufacturing", "product design", "quality control", "maintenance", "cad", "tolerance", "gd&t"]),
            "Civil Engineer", "Electrical Engineer", "Electronics Engineer", "Chemical Engineer", "Automobile Engineer", "Structural Engineer", "Industrial Engineer", "Production Engineer", "Quality Engineer", "Maintenance Engineer", "Design Engineer", "Site Engineer", "Project Engineer"],
              ["AutoCAD", "Design software", "Quality control", "Safety standards", "Project coordination", "Technical drawing", "MS Project"], ["design", "cad", "specification", "standards", "safety", "quality", "site", "commissioning"], _sec(experience="Engineering Experience", projects="Engineering Projects", skills="Technical Skills", achievements="Certifications & Achievements", groups=["Design & analysis tools", "Equipment & processes", "Standards"], extra=[{"label": "Industry standards & licences", "hint": "ISO, IS codes, PE or similar, if you hold them"}], projects_step=True), ["technical", "professional"], "Use engineering terms: design, tolerances, standards, equipment, site work."),
    ]},
    {"key": "healthcare", "name": "Healthcare & Medical", "icon": "heart", "departments": [
        _dept("healthcare-clinical", "Clinical & Nursing", [
            role("Registered Nurse", skills=["Patient Assessment", "Medication Administration", "IV Therapy", "Wound Care", "Electronic Health Records", "Patient Education", "Infection Control", "Emergency Response", "BLS/ACLS"], keywords=["patient care", "clinical", "medication administration", "iv therapy", "ehr", "infection control", "triage", "nursing"]),
            "General Physician", "Specialist Doctor", "Pharmacist", "Physiotherapist", "Medical Laboratory Technician", "Radiologist"],
              ["Patient care", "Clinical assessment", "Medical records", "Infection control", "Emergency response", "Patient education"], ["patient care", "clinical", "diagnosis", "treatment", "ehr", "protocol", "license", "hospital"], _sec(experience="Clinical Experience", skills="Clinical Skills", achievements="Certifications & Achievements", groups=["Clinical skills", "Systems", "Specialisation"], extra=[{"label": "Licenses & registrations", "hint": "Council registration number and validity, only if you hold one"}, {"label": "Clinical certifications", "hint": "BLS, ACLS, speciality certificates"}]), ["professional", "classic"], "Use clinical terms appropriate to the role. Never state a licence or qualification the person did not give."),
        _dept("healthcare-admin", "Healthcare Administration & Research", ["Medical Representative", "Healthcare Administrator", "Hospital Manager", "Clinical Research Associate", "Medical Coder", "Public Health Specialist"],
              ["Healthcare operations", "Regulatory compliance", "Medical coding", "Clinical trials", "Patient records", "Stakeholder management"], ["healthcare", "compliance", "clinical trials", "icd", "operations", "patient", "regulatory"], _sec(experience="Healthcare Experience", skills="Healthcare Skills", extra=[{"label": "Certifications & registrations", "hint": "Only those you hold"}]), ["professional", "minimal"], "Use healthcare administration and research terms."),
    ]},
    {"key": "education", "name": "Education & Training", "icon": "book", "departments": [
        _dept("education-teaching", "Teaching & Academia", [
            role("Primary School Teacher", skills=["Classroom Management", "Lesson Planning", "Curriculum Development", "Student Assessment", "Subject Expertise", "Educational Technology", "Communication", "Child Development"], keywords=["classroom management", "lesson planning", "curriculum", "student assessment", "differentiated instruction", "parent communication"]),
            role("Secondary School Teacher", skills=["Classroom Management", "Lesson Planning", "Curriculum Development", "Student Assessment", "Subject Expertise", "Educational Technology", "Communication"], keywords=["classroom management", "lesson planning", "curriculum", "student assessment", "board exams", "subject expertise"]),
            "Lecturer", "Professor", "Academic Coordinator", "Principal", "School Administrator", "Teaching Assistant", "Research Scholar"],
              ["Lesson planning", "Classroom management", "Curriculum design", "Assessment", "Educational technology", "Mentoring"], ["curriculum", "pedagogy", "assessment", "classroom", "students", "learning outcomes", "teaching"], _sec(experience="Teaching Experience", projects="Academic Projects", skills="Teaching Skills", achievements="Academic Achievements", groups=["Subjects taught", "Teaching methods", "Tools"], extra=[{"label": "Subjects and classes taught", "hint": "Subject, grade or class, board"}, {"label": "Publications & conferences", "hint": "Papers, talks, workshops"}]), ["classic", "professional"], "Use education terms: classes, curriculum, assessment, outcomes."),
        _dept("education-training", "Corporate Training & Design", ["Corporate Trainer", "Instructional Designer", "Educational Consultant"], ["Training delivery", "Needs analysis", "Instructional design", "LMS", "Facilitation", "Assessment design", "Presentation"], ["training", "instructional design", "facilitation", "learning", "lms", "needs analysis"], _sec(experience="Training Experience", skills="Training Skills"), ["modern", "professional"], "Use learning and development terms."),
    ]},
    {"key": "business", "name": "Business, Management & Operations", "icon": "chart", "departments": [
        _dept("business-management", "Management & Strategy", [
            role("Project Manager", skills=["Project Planning", "Stakeholder Management", "Risk Management", "Budgeting", "Agile", "Scrum", "MS Project", "Resource Planning", "Reporting", "Leadership"], keywords=["project plan", "stakeholder", "risk", "budget", "agile", "scrum", "milestones", "delivery", "pmp"]),
            role("Business Analyst", skills=["Requirements Gathering", "Process Mapping", "SQL", "Excel", "Stakeholder Management", "User Stories", "Data Analysis", "Documentation", "JIRA"], keywords=["requirements", "stakeholder", "process", "user stories", "gap analysis", "sql", "documentation", "uat"]),
            "Data Business Analyst", "Product Manager", "Program Manager", "Operations Manager", "Operations Executive", "Management Consultant", "Strategy Analyst", "Process Improvement Specialist", "Supply Chain Manager", "Procurement Manager"],
              ["Stakeholder management", "Planning", "Reporting", "Process improvement", "Budgeting", "Leadership"], ["stakeholder", "strategy", "process", "kpi", "budget", "delivery", "operations", "reporting"], _sec(experience="Professional Experience", skills="Management Skills", groups=["Management & delivery", "Tools"], extra=[{"label": "Certifications", "hint": "PMP, PRINCE2, Six Sigma, if you hold them"}]), ["professional", "modern"], "Use management terms: scope, stakeholders, delivery, outcomes."),
    ]},
    {"key": "legal", "name": "Legal & Compliance", "icon": "scale", "departments": [
        _dept("legal-core", "Legal & Compliance", ["Lawyer", "Advocate", "Legal Advisor", "Corporate Counsel", "Legal Associate", "Compliance Officer", "Legal Researcher", "Contract Manager", "Company Secretary", "Paralegal"],
              ["Legal research", "Drafting", "Contract review", "Compliance", "Litigation support", "Negotiation", "Case management"], ["contract", "compliance", "litigation", "drafting", "legal research", "regulatory", "due diligence"], _sec(experience="Legal Experience", skills="Legal Skills", achievements="Cases & Achievements", extra=[{"label": "Bar enrolment & registrations", "hint": "Enrolment number and bar council, only if you hold one"}]), ["classic", "professional"], "Use legal terms appropriate to the role. Never state a qualification the person did not give."),
    ]},
    {"key": "creative", "name": "Design, Creative & Media", "icon": "palette", "departments": [
        _dept("creative-design", "Design & Media", [
            role("Graphic Designer", skills=["Adobe Photoshop", "Adobe Illustrator", "InDesign", "Typography", "Branding", "Layout Design", "Colour Theory", "Print Design", "Figma"], keywords=["branding", "typography", "photoshop", "illustrator", "layout", "visual identity", "portfolio"]),
            "UI Designer", "UX Designer", "Product Designer", "Visual Designer", "Motion Graphics Designer", "Video Editor", "Photographer", "Content Writer", "Technical Writer", "Copywriter", "Animator", "Art Director", "Creative Director"],
              ["Design tools", "Typography", "Branding", "Visual storytelling", "Prototyping", "Creative direction"], ["design", "portfolio", "branding", "creative", "visual", "typography", "user experience"], _sec(experience="Professional Experience", projects="Selected Work", skills="Creative Skills", groups=["Design tools", "Creative skills"], extra=[{"label": "Portfolio & links", "hint": "Behance, Dribbble, website"}], projects_step=True), ["creative", "modern"], "Use design and creative terms. Point to portfolio work the person named."),
    ]},
    {"key": "hospitality", "name": "Hospitality, Tourism & Travel", "icon": "hotel", "departments": [
        _dept("hospitality-core", "Hospitality & Travel", ["Hotel Manager", "Front Office Executive", "Restaurant Manager", "Chef", "Travel Consultant", "Tour Manager", "Guest Relations Executive", "Event Manager", "Food & Beverage Manager", "Airline Customer Service Executive"],
              ["Guest service", "Front desk operations", "Event coordination", "Food safety", "Reservations", "Team supervision", "Upselling"], ["guest satisfaction", "service", "reservations", "operations", "food safety", "events", "hospitality"], _sec(experience="Hospitality Experience", skills="Hospitality Skills", extra=[{"label": "Languages", "hint": "Languages you can serve guests in"}]), ["classic", "modern"], "Use hospitality terms: guests, service standards, occupancy, events."),
    ]},
    {"key": "manufacturing", "name": "Manufacturing & Production", "icon": "factory", "departments": [
        _dept("manufacturing-core", "Manufacturing & Production", ["Production Manager", "Plant Manager", "Manufacturing Engineer", "Production Supervisor", "Quality Control Inspector", "Industrial Safety Officer", "Factory Operations Manager", "Inventory Controller", "Maintenance Supervisor"],
              ["Production planning", "Lean manufacturing", "Quality control", "Safety compliance", "Inventory control", "Six Sigma", "Maintenance"], ["production", "lean", "quality", "safety", "throughput", "oee", "inventory", "iso"], _sec(experience="Production Experience", skills="Technical Skills", extra=[{"label": "Safety & quality certifications", "hint": "NEBOSH, Six Sigma, ISO auditor, if you hold them"}]), ["professional", "technical"], "Use manufacturing terms: output, yield, downtime, safety, quality."),
    ]},
    {"key": "logistics", "name": "Logistics, Supply Chain & Transportation", "icon": "truck", "departments": [
        _dept("logistics-core", "Logistics & Supply Chain", ["Logistics Executive", "Logistics Manager", "Warehouse Manager", "Supply Chain Analyst", "Fleet Manager", "Transportation Coordinator", "Inventory Manager", "Export/Import Executive", "Dispatch Supervisor"],
              ["Inventory management", "Route planning", "Warehouse operations", "Import/export documentation", "ERP", "Vendor management", "Forecasting"], ["logistics", "inventory", "warehouse", "supply chain", "shipment", "customs", "fleet", "delivery"], _sec(experience="Logistics Experience", skills="Logistics Skills"), ["professional", "classic"], "Use logistics terms: shipments, lead times, stock accuracy, routes."),
    ]},
    {"key": "retail", "name": "Retail & E-commerce", "icon": "bag", "departments": [
        _dept("retail-core", "Retail & E-commerce", ["Store Manager", "Retail Sales Associate", "Merchandising Manager", "E-commerce Manager", "Category Manager", "Retail Operations Manager", "Customer Experience Specialist", "Visual Merchandiser"],
              ["Merchandising", "Inventory control", "POS systems", "Customer service", "Category planning", "Marketplace management", "Visual display"], ["retail", "merchandising", "sales", "inventory", "customer experience", "e-commerce", "category"], _sec(experience="Retail Experience", skills="Retail Skills", achievements="Sales Achievements"), ["modern", "classic"], "Use retail terms: footfall, conversion, stock, merchandising."),
    ]},
    {"key": "customer", "name": "Customer Service & Support", "icon": "headset", "departments": [
        _dept("customer-core", "Customer Service & Support", ["Customer Support Executive", "Customer Success Manager", "Technical Support Engineer", "Call Center Executive", "Service Desk Analyst", "Client Relationship Manager", "Customer Experience Manager"],
              ["Customer communication", "Ticketing systems", "Issue resolution", "CRM", "Empathy", "Product knowledge", "Escalation handling"], ["customer satisfaction", "csat", "resolution", "tickets", "sla", "crm", "retention"], _sec(experience="Support Experience", skills="Support Skills"), ["modern", "minimal"], "Use customer-support terms: tickets, resolution time, satisfaction."),
    ]},
    {"key": "government", "name": "Government, Public Sector & Defence", "icon": "landmark", "departments": [
        _dept("government-core", "Government & Public Service", ["Government Administrative Officer", "Public Relations Officer", "Civil Services Professional", "Police Officer", "Defence Personnel", "Public Sector Engineer", "Government Accountant", "Public Policy Analyst"],
              ["Public administration", "Policy analysis", "Report writing", "Record keeping", "Leadership", "Discipline", "Community engagement"], ["administration", "policy", "public service", "compliance", "reporting", "governance"], _sec(experience="Service Experience", skills="Skills", extra=[{"label": "Service details & awards", "hint": "Postings, ranks, commendations"}]), ["classic", "professional"], "Use public-service terms. Give full qualification and service details."),
    ]},
    {"key": "agriculture", "name": "Agriculture & Environmental Sciences", "icon": "leaf", "departments": [
        _dept("agri-core", "Agriculture & Environment", ["Agricultural Officer", "Agronomist", "Agricultural Engineer", "Environmental Engineer", "Environmental Scientist", "Horticulture Specialist", "Food Technologist", "Sustainability Consultant"],
              ["Crop management", "Soil analysis", "Environmental impact assessment", "GIS", "Sustainability reporting", "Food safety", "Field research"], ["agronomy", "environmental", "sustainability", "field", "soil", "impact assessment", "food safety"], _sec(experience="Field & Professional Experience", projects="Projects & Studies", skills="Technical Skills", projects_step=True), ["professional", "technical"], "Use agriculture and environmental science terms."),
    ]},
    {"key": "research", "name": "Research & Development", "icon": "flask", "departments": [
        _dept("research-core", "Research & Development", ["Research Scientist", "Research Associate", "Research Engineer", "Laboratory Researcher", "Clinical Research Scientist", "R&D Manager", "Scientific Analyst"],
              ["Experimental design", "Data analysis", "Scientific writing", "Laboratory techniques", "Statistics", "Literature review", "Grant writing"], ["research", "experiment", "publication", "analysis", "laboratory", "methodology", "grant"], _sec(experience="Research Experience", projects="Research Projects", skills="Research Skills", achievements="Awards & Grants", extra=[{"label": "Publications", "hint": "Papers, patents, preprints"}, {"label": "Conferences & talks", "hint": "Presentations and posters"}], projects_step=True), ["classic", "professional"], "Use research terms: hypotheses, methods, publications, findings."),
    ]},
    {"key": "construction", "name": "Real Estate & Construction", "icon": "building", "departments": [
        _dept("construction-core", "Real Estate & Construction", ["Real Estate Agent", "Property Manager", "Construction Manager", "Quantity Surveyor", "Site Supervisor", "Architect", "Interior Designer", "Real Estate Analyst"],
              ["Site supervision", "Estimation", "AutoCAD", "Project scheduling", "Contract administration", "Property valuation", "Client handling"], ["construction", "site", "estimation", "boq", "property", "valuation", "contracts", "safety"], _sec(experience="Professional Experience", projects="Projects", skills="Technical Skills", projects_step=True, extra=[{"label": "Licences & registrations", "hint": "Council of Architecture, RERA or similar, only if you hold one"}]), ["professional", "technical"], "Use construction and real estate terms: sites, estimates, handovers."),
    ]},
    {"key": "other", "name": "Other Professions", "icon": "briefcase", "departments": [
        _dept("other-self", "Self-employed, Freelance & Consulting", ["Entrepreneur", "Freelancer", "Consultant", "Social Worker", "Non-profit Programme Manager", "Fitness Trainer", "Sports Coach", "Security Supervisor", "Beauty Therapist", "Skilled Tradesperson", "Automotive Technician", "Telecom Engineer", "Energy & Utilities Technician", "Mining Engineer"],
              ["Client management", "Planning", "Communication", "Budgeting", "Problem solving", "Time management"], ["clients", "projects", "delivery", "results", "management", "service"], _sec(experience="Professional Experience", skills="Skills"), ["modern", "classic"], "Use plain professional terms for the person's own field."),
    ]},
]


def soft_skills() -> list[str]:
    return list(_SOFT)
