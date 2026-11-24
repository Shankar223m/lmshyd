import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UploadCloud } from "lucide-react";

import { useCreateCourseMutation } from "@/modules/catalog/courses/api/coursesApi";
import { useUpdateAdminCoursePricingMutation } from "@/modules/billing/institutional/api/institutionalApi";
import { uploadMediaMultipart } from "@/modules/media/api/uploadMediaMultipart";
import { useNotify } from "@/core/hooks/useNotify";

const CATEGORIES = [
  "Development",
  "AI & Machine Learning",
  "Data Science",
  "Design",
  "Business",
  "Marketing",
  "Cloud & DevOps",
  "Cybersecurity",
];

export function CourseCreatePage() {
  const navigate = useNavigate();
  const notify = useNotify();

  const [createCourse, { isLoading: isCreating }] = useCreateCourseMutation();
  const [updatePricing] = useUpdateAdminCoursePricingMutation();

  // Form Fields
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Development");
  const [level, setLevel] = useState<"Beginner" | "Intermediate" | "Advanced">("Beginner");
  const [description, setDescription] = useState("");

  // Toggles
  const [isPublished, setIsPublished] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [hasCertificate, setHasCertificate] = useState(true);

  // Pricing
  const [pricingType, setPricingType] = useState<"free" | "paid">("paid");
  const [priceInr, setPriceInr] = useState("1999");
  const institutionalSeatPrice = "499";

  // Banner Upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      notify.error("Please select an image file (PNG, JPG, or WEBP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      notify.error("Banner image exceeds 2MB limit.");
      return;
    }

    setBannerFile(file);
    const objectUrl = URL.createObjectURL(file);
    setBannerPreviewUrl(objectUrl);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify.error("Please drop an image file.");
      return;
    }
    setBannerFile(file);
    setBannerPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) {
      newErrors.title = "Course title is required.";
    } else if (title.trim().length < 3) {
      newErrors.title = "Course title must be at least 3 characters.";
    }
    if (!category) {
      newErrors.category = "Category is required.";
    }
    if (!description.trim()) {
      newErrors.description = "Course description is required.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      notify.error("Please fill in all required fields.");
      return;
    }

    setErrors({});
    let uploadedMediaId: string | null = null;

    try {
      if (bannerFile) {
        setIsUploadingBanner(true);
        try {
          const result = await uploadMediaMultipart({
            file: bannerFile,
            kind: "image",
            title: `${title} Banner`,
          });
          uploadedMediaId = result.asset_id;
        } catch (bannerErr: any) {
          console.warn("Banner upload failed, proceeding with course creation:", bannerErr);
        }
      }

      // Encode structured metadata in summary string (enforcing 490 chars limit for backend safety)
      const rawSummary = `[Category: ${category}] [${level}] [Instructor: ExamLMS Faculty] [Certificate: ${hasCertificate ? "Yes" : "No"}] [Featured: ${isFeatured ? "Yes" : "No"}] ${description.trim()}`;
      const cleanSummary = rawSummary.slice(0, 490);

      const baseSlug =
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || "course";
      const slug = `${baseSlug.slice(0, 40)}-${Date.now()}`;

      const coursePayload: any = {
        title: title.trim(),
        slug,
        summary: cleanSummary,
      };
      if (uploadedMediaId) {
        coursePayload.thumbnail_media_id = uploadedMediaId;
      }

      const createdCourse = await createCourse(coursePayload).unwrap();
      const courseId = String(
        createdCourse?.course_id ||
        (createdCourse as any)?.id ||
        (createdCourse as any)?.public_id ||
        ""
      );

      // Configure pricing if paid (isolated in try/catch so it never blocks course creation)
      if (courseId) {
        const numPrice = Number(priceInr) || 0;
        const numSeat = Number(institutionalSeatPrice) || 0;
        try {
          await updatePricing({
            course_id: courseId,
            course_title: title.trim(),
            individual_price_paise: pricingType === "free" ? 0 : numPrice * 100,
            institutional_price_per_seat_paise: pricingType === "free" ? 0 : numSeat * 100,
            fixed_price_paise: pricingType === "free" ? 0 : numPrice * 100,
            reason: "Course creation pricing",
          }).unwrap();
        } catch (priceErr) {
          console.warn("Optional course pricing setup failed (ignored for draft):", priceErr);
        }
      }

      notify.success("Course created! Opening Course Builder...");

      // Transition immediately to Course Builder (Screen 2)
      if (courseId) {
        navigate(`/courses/${courseId}/builder`);
      } else {
        navigate("/courses");
      }
    } catch (err: any) {
      console.error("Course creation failed:", err);
      const msg =
        err?.data?.message ||
        err?.data?.detail ||
        err?.data?.error?.message ||
        err?.message ||
        "Failed to create course.";
      notify.error(msg);
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const isSubmitting = isCreating || isUploadingBanner;

  return (
    <div className="admin-lms-page">
      {/* Breadcrumb */}
      <nav className="admin-lms-breadcrumb">
        <Link to="/courses">Courses</Link>
        <span className="sep">&gt;</span>
        <span className="current">Create Course</span>
      </nav>

      {/* Header */}
      <header className="admin-lms-header">
        <div className="admin-lms-header-titles">
          <h1>Create New Course</h1>
        </div>
        <div className="admin-lms-header-actions">
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={() => navigate("/courses")}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save Course"}
          </button>
        </div>
      </header>

      {/* 3-Column Form Layout matching Reference Top-Left Screen */}
      <div className="create-course-grid">
        {/* Left Column: Banner Upload & Live Preview */}
        <div className="admin-card">
          <div
            className="admin-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <div className="admin-dropzone-icon">
              <UploadCloud size={24} />
            </div>
            <div className="admin-dropzone-title">Upload Course Banner</div>
            <div className="admin-dropzone-desc">JPG, PNG (Max 2MB)</div>
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              style={{ height: 32, fontSize: 12, padding: "0 14px" }}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Choose File
            </button>
          </div>

          {bannerPreviewUrl && (
            <div className="admin-preview-thumbnail-card">
              <img src={bannerPreviewUrl} alt="Course banner preview" />
              {bannerFile && (
                <button
                  type="button"
                  className="admin-preview-remove-btn"
                  onClick={() => {
                    setBannerFile(null);
                    setBannerPreviewUrl(null);
                  }}
                >
                  Reset
                </button>
              )}
            </div>
          )}
        </div>

        {/* Center Column: Course Info */}
        <div className="admin-card">
          <div className="admin-form-group">
            <label className="admin-form-label">
              Course Title <span className="required">*</span>
            </label>
            <input
              type="text"
              className="admin-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter course title..."
            />
            {errors.title && (
              <span className="text-red-500 text-xs mt-1 block">{errors.title}</span>
            )}
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">
              Category <span className="required">*</span>
            </label>
            <select
              className="admin-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">
              Level <span className="required">*</span>
            </label>
            <select
              className="admin-select"
              value={level}
              onChange={(e) => setLevel(e.target.value as any)}
            >
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Description</label>
            <textarea
              className="admin-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Course description..."
            />
            {errors.description && (
              <span className="text-red-500 text-xs mt-1 block">{errors.description}</span>
            )}
          </div>
        </div>

        {/* Right Column: Toggles & Price */}
        <div className="admin-card">
          <div className="admin-toggle-row">
            <div className="admin-toggle-info">
              <span className="admin-toggle-title">Published</span>
              <span className="admin-toggle-sub">Make course live</span>
            </div>
            <label className="admin-switch">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
              />
              <span className="admin-switch-slider" />
            </label>
          </div>

          <div className="admin-toggle-row">
            <div className="admin-toggle-info">
              <span className="admin-toggle-title">Featured Course</span>
              <span className="admin-toggle-sub">Show on homepage</span>
            </div>
            <label className="admin-switch">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
              />
              <span className="admin-switch-slider" />
            </label>
          </div>

          <div className="admin-toggle-row">
            <div className="admin-toggle-info">
              <span className="admin-toggle-title">Certificate</span>
              <span className="admin-toggle-sub">Provide certificate</span>
            </div>
            <label className="admin-switch">
              <input
                type="checkbox"
                checked={hasCertificate}
                onChange={(e) => setHasCertificate(e.target.checked)}
              />
              <span className="admin-switch-slider" />
            </label>
          </div>

          <div style={{ marginTop: 24 }}>
            <label className="admin-form-label">Course Price</label>
            <div className="admin-radio-group">
              <label className="admin-radio-label">
                <input
                  type="radio"
                  name="pricingType"
                  value="free"
                  checked={pricingType === "free"}
                  onChange={() => setPricingType("free")}
                />
                Free
              </label>
              <label className="admin-radio-label">
                <input
                  type="radio"
                  name="pricingType"
                  value="paid"
                  checked={pricingType === "paid"}
                  onChange={() => setPricingType("paid")}
                />
                Paid
              </label>
            </div>

            {pricingType === "paid" && (
              <div className="admin-price-input-wrap">
                <span className="admin-price-prefix">₹</span>
                <input
                  type="number"
                  className="admin-input"
                  value={priceInr}
                  onChange={(e) => setPriceInr(e.target.value)}
                  placeholder="49"
                  min="0"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
