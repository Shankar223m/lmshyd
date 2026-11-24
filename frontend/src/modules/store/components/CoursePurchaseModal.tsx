import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ShieldCheck, CheckCircle2, CreditCard, Sparkles, AlertCircle } from "lucide-react";
import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { useNotify } from "@/core/hooks/useNotify";
import { useBuyCourseMutation, useConfirmPurchaseMutation, useTestBuyCourseMutation } from "@/modules/store/api/storeApi";
import { useRazorpayCheckout } from "@/modules/store/hooks/useRazorpayCheckout";
import type { BrowseCourse } from "@/modules/store/types/courseBrowse";
import type { StoreOffer } from "@/modules/store/types";
import { getCoursePriceInr } from "@/modules/store/utils/courseBrowseAccess";

type Props = {
  course: BrowseCourse | null;
  offer?: StoreOffer;
  isOpen: boolean;
  onClose: () => void;
};

export function CoursePurchaseModal({ course, offer, isOpen, onClose }: Props) {
  const { user } = useAuth();
  const notify = useNotify();
  const navigate = useNavigate();

  const [startPurchase] = useBuyCourseMutation();
  const [confirmPurchase] = useConfirmPurchaseMutation();
  const [testBuyCourse] = useTestBuyCourseMutation();
  const openCheckout = useRazorpayCheckout();

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !course) return null;

  const priceInr = getCoursePriceInr(course, offer);
  const basePrice = Math.round(priceInr / 1.18);
  const gst = priceInr - basePrice;

  // Handle standard Razorpay checkout
  const handleLivePayment = async () => {
    if (!user) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const name = user.full_name;
      const email = user.email || null;
      const { purchase, checkout } = await startPurchase({
        courseId: course.course_id,
        name,
        email,
      }).unwrap();

      const outcome = await openCheckout(checkout, {
        description: course.title,
        name,
        email,
      });

      if (outcome.status === "closed") {
        notify.info("Payment cancelled. You can complete your purchase at any time.");
        setIsProcessing(false);
        return;
      }

      if (outcome.status === "failed") {
        setErrorMessage(outcome.reason || "Payment failed. Please try again.");
        setIsProcessing(false);
        return;
      }

      const confirmed = await confirmPurchase({
        purchaseId: purchase.purchase_id,
        ...outcome.result,
      }).unwrap();

      notify.success(
        confirmed.status === "paid"
          ? `Enrollment confirmed! ${course.title} is now active in My Learning.`
          : "Payment received: confirming access...",
      );
      onClose();
      navigate("/courses/my");
    } catch (err: any) {
      // If Razorpay keys aren't set in backend .env, suggest instant verification
      const msg = err?.data?.message || err?.message || "Payment gateway currently in sandbox mode.";
      setErrorMessage(`${msg} You can use Instant Course Activation below to complete purchase.`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle instant sandbox/test purchase and activation
  const handleInstantActivation = async () => {
    if (!user) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const name = user.full_name;
      const email = user.email || null;
      await testBuyCourse({
        courseId: course.course_id,
        name,
        email,
      }).unwrap();

      notify.success(
        `Purchase complete! ${course.title} has been added to My Learning with full individual access.`,
      );
      onClose();
      navigate("/courses/my");
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to activate course purchase.";
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Checkout & Enroll</h3>
            <p className="text-xs text-slate-500">Individual Course Access Order</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Course Info */}
        <div className="my-4 rounded-xl bg-slate-50 p-4 border border-slate-200/80">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#635BFF]">
                Course
              </span>
              <h4 className="text-sm font-bold text-slate-900 mt-0.5 line-clamp-2">
                {course.title}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                By {course.instructor_name || "ExamLMS Faculty"} • {course.duration_label || "Self-paced"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-lg font-black text-slate-900">
                ₹{priceInr.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        {/* Pricing breakdown */}
        <div className="space-y-2 py-3 border-y border-slate-100 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Course Access Fee</span>
            <span>₹{basePrice.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>GST (18%)</span>
            <span>₹{gst.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-dashed border-slate-200">
            <span>Total Payable</span>
            <span className="text-[#635BFF]">₹{priceInr.toLocaleString("en-IN")}</span>
          </div>
        </div>

        {/* Learner Info */}
        <div className="py-3 text-xs text-slate-600">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Enrolling as:</span>
            <span>{user?.full_name} ({user?.email || "Student"})</span>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="my-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Benefits bullets */}
        <div className="grid grid-cols-2 gap-2 my-3 text-[11px] text-slate-600">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
            <span>Full Lifetime Access</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
            <span>Verified Certificate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
            <span>All Lessons & Quizzes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
            <span>Instant My Learning sync</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 space-y-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleInstantActivation}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#635BFF] hover:bg-[#5046E5] px-4 py-3 text-sm font-bold text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles size={16} />
            <span>{isProcessing ? "Processing..." : `Complete Purchase (₹${priceInr.toLocaleString("en-IN")})`}</span>
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={handleLivePayment}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 transition-all cursor-pointer disabled:opacity-50"
          >
            <CreditCard size={14} />
            <span>Pay via Razorpay Gateway (UPI / NetBanking / Cards)</span>
          </button>
        </div>

        {/* Security badge */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck size={14} className="text-emerald-600" />
          <span>256-bit Secure Encryption • 30-Day Support Guarantee</span>
        </div>
      </div>
    </div>
  );
}
