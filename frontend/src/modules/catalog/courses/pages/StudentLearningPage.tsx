import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { useStudentType } from "@/modules/user-management/auth/hooks/useStudentType";
import { useGetCourseQuery, useGetVersionQuery } from "@/modules/catalog/courses/api/coursesApi";
import {
  useListEnrollmentsQuery,
  useGetUnlockStateQuery,
  useCompleteItemMutation,
} from "@/modules/learning/enrollments/api/enrollmentsApi";
import { useListMyCoursesQuery } from "@/modules/learning/common/api/myCoursesApi";
import { useGetMyTestQuery, useListAttemptsQuery } from "@/modules/assessments/attempts/api/attemptsApi";
import {
  useListCertificatesQuery,
  useGetCertificateDownloadMutation,
} from "@/modules/certificates/issued/api/certificatesApi";
import { PageLoader } from "@/shared/ui";
import { useNotify } from "@/core/hooks/useNotify";
import { env } from "@/core/config/env";
import { cn } from "@/core/lib/cn";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize2,
  CheckCircle2,
  Award,
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Menu,
  X,
  FileText,
  Check,
  Download,
  GripVertical,
  BookOpen,
  Eye,
  Settings2,
  ShieldAlert,
  Plus,
  Minus,
  Edit3,
  Send,
  Trash2,
} from "lucide-react";
import { InAppPdfViewer } from "../components/InAppPdfViewer";
import { StudentAssessmentRunner } from "@/modules/catalog/courses/components/assessment/StudentAssessmentRunner";

export type LeftContentView =
  | { type: "lesson" }
  | { type: "chapter_test"; testId: string; chapterTitle: string; chapterId: string; moduleId: string }
  | { type: "module_test"; testId: string; moduleTitle: string; moduleId: string }
  | { type: "final_exam" }
  | { type: "certificate" };

type LessonTab = "description" | "resources" | "discussion";
type SidebarTab = "content" | "notes";

export type VideoQuality = "Auto" | "420p" | "720p" | "1080p" | "2040p";

interface VideoQualityOption {
  id: VideoQuality;
  label: string;
  resolution: string;
  badge: string;
  description: string;
  src: string;
}

const QUALITY_OPTIONS: VideoQualityOption[] = [
  {
    id: "Auto",
    label: "Auto",
    resolution: "Auto (1080p Adaptive)",
    badge: "Auto (1080p)",
    description: "Adaptive resolution based on connection speed",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  },
  {
    id: "2040p",
    label: "2040p",
    resolution: "4K UHD (2160p / 2040p)",
    badge: "2040p 4K",
    description: "Ultra High Definition 2040p (4K UHD)",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  },
  {
    id: "1080p",
    label: "1080p",
    resolution: "Full HD (1080p)",
    badge: "1080p FHD",
    description: "Standard Full High Definition stream",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  },
  {
    id: "720p",
    label: "720p",
    resolution: "HD (720p)",
    badge: "720p HD",
    description: "High Definition standard stream",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  },
  {
    id: "420p",
    label: "420p",
    resolution: "SD (420p)",
    badge: "420p SD",
    description: "Standard definition, low bandwidth saver",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  },
];

interface SavedVideoProgress {
  currentTime: number;
  duration: number;
  percent: number;
  completed: boolean;
  watchedIntervals?: [number, number][];
  updatedAt: string;
}

interface LessonNote {
  id: string;
  timestamp: number;
  timestampFormatted: string;
  text: string;
  createdAt: string;
}

interface DiscussionComment {
  id: string;
  author: string;
  role: string;
  avatar?: string;
  text: string;
  createdAt: string;
  likes: number;
}

export function StudentLearningPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const notify = useNotify();
  const { user } = useAuth();
  const { isExternalStudent, isInstitutionStudent } = useStudentType();

  // Navigation and active view state
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [leftContentView, setLeftContentView] = useState<LeftContentView>({ type: "lesson" });
  const [activeLessonTab, setActiveLessonTab] = useState<LessonTab>("description");
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>("content");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Accordion state for modules: initialized so that active module and all modules are expanded
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // Layout split width (Desktop: 68% left / 32% right default)
  const [leftWidthPct, setLeftWidthPct] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("examlms_learning_split_pct");
      if (saved) {
        const val = Number(saved);
        if (val >= 45 && val <= 78) return val;
      }
    } catch {}
    return 67;
  });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Video Player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Video Quality State
  const [videoQuality, setVideoQuality] = useState<VideoQuality>("Auto");
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const qualityMenuRef = useRef<HTMLDivElement>(null);

  // In-App PDF Viewer State
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);

  // Notes state
  const [newNoteText, setNewNoteText] = useState("");
  const [noteIncludeTimestamp, setNoteIncludeTimestamp] = useState(true);

  // Discussion state
  const [newCommentText, setNewCommentText] = useState("");

  // Storage key for progress
  const progressStorageKey = useMemo(() => {
    const studentId = user?.user_id || "guest";
    return `examlms_video_progress_${studentId}_${courseId || "default"}`;
  }, [user?.user_id, courseId]);

  // Map of topicId -> SavedVideoProgress
  const [videoProgressMap, setVideoProgressMap] = useState<Record<string, SavedVideoProgress>>(() => {
    try {
      const studentId = user?.user_id || "guest";
      const key = `examlms_video_progress_${studentId}_${courseId || "default"}`;
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored);
    } catch {}
    return {};
  });

  // Re-sync videoProgressMap with monotonic preservation whenever progressStorageKey changes or on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(progressStorageKey);
      if (stored) {
        const parsed: Record<string, SavedVideoProgress> = JSON.parse(stored);
        setVideoProgressMap((current) => {
          const merged: Record<string, SavedVideoProgress> = { ...parsed, ...current };
          for (const [k, v] of Object.entries(parsed)) {
            const cur = current[k];
            if (cur) {
              const isDone = Boolean(cur.completed || v.completed || (cur.percent ?? 0) >= 100 || (v.percent ?? 0) >= 100);
              merged[k] = {
                ...v,
                ...cur,
                percent: isDone ? 100 : Math.max(cur.percent || 0, v.percent || 0),
                completed: isDone,
              };
            }
          }
          return merged;
        });
      }
    } catch {}
  }, [progressStorageKey]);

  // Queries
  const { data: course, isLoading: isCourseLoading, isError: isCourseError } = useGetCourseQuery(courseId ?? "", {
    skip: !courseId,
  });

  const publishedVersion = course?.versions?.find((v) => v.status === "published");
  const versionId = publishedVersion?.version_id;
  const { data: versionDetail, isLoading: isVersionLoading } = useGetVersionQuery(
    { courseId: courseId ?? "", versionId: versionId ?? "" },
    { skip: !courseId || !versionId }
  );

  const { data: enrollmentsData, isLoading: isEnrollmentsLoading, refetch: refetchEnrollments } = useListEnrollmentsQuery({
    status: "active",
    per_page: 50,
  });

  const { data: myCourses, refetch: refetchMyCourses } = useListMyCoursesQuery();

  // Find enrollment for this course
  const enrollment = useMemo(() => {
    const list = enrollmentsData?.items ?? [];
    const courseMatch = myCourses?.find((c) => String(c.course_id) === String(courseId));
    if (courseMatch?.enrollment_id) {
      const found = list.find((e) => String(e.enrollment_id) === String(courseMatch.enrollment_id));
      if (found) return found;
    }
    const directMatch = list.find(
      (e: any) =>
        String(e.batch?.course_id || e.course_id) === String(courseId) &&
        e.status === "active"
    );
    return directMatch || null;
  }, [enrollmentsData, myCourses, courseId]);

  const { data: unlockState, refetch: refetchUnlockState } = useGetUnlockStateQuery(enrollment?.enrollment_id ?? "", {
    skip: !enrollment?.enrollment_id,
  });

  const [completeItemMutation, { isLoading: isCompleting }] = useCompleteItemMutation();

  // Final Exam Query
  const finalTestId = versionDetail?.rule?.final_test_id;
  const { data: finalTestDetail } = useGetMyTestQuery(String(finalTestId ?? ""), {
    skip: !finalTestId,
  });
  const { data: finalAttemptsData } = useListAttemptsQuery(
    { test_id: finalTestId ? String(finalTestId) : undefined },
    { skip: !finalTestId }
  );

  // Modules List from unlockState or versionDetail
  const modulesList = useMemo(() => {
    const rawModules = versionDetail?.modules ?? [];
    const unlockMods = unlockState?.modules ?? [];

    if (rawModules.length === 0 && unlockMods.length > 0) {
      return unlockMods;
    }

    return rawModules.map((m, mIdx) => {
      const unlockMod = unlockMods.find((um) => String(um.module_id) === String(m.module_id));
      return {
        module_id: m.module_id,
        title: m.title,
        position: m.position || mIdx + 1,
        module_test_id: (m as any).module_test_id,
        unlocked: unlockMod ? unlockMod.unlocked : true,
        completed: unlockMod ? unlockMod.completed : false,
        test_passed: unlockMod ? Boolean((unlockMod as any).test_passed) : false,
        topics: (m.topics ?? []).map((t, tIdx) => {
          const unlockTopic = unlockMod?.topics?.find((ut: any) => String(ut.topic_id) === String(t.topic_id));
          return {
            topic_id: t.topic_id,
            title: t.title,
            position: t.position || tIdx + 1,
            topic_test_id: t.topic_test_id,
            unlocked: unlockTopic ? unlockTopic.unlocked : true,
            completed: unlockTopic ? unlockTopic.completed : false,
            test_passed: unlockTopic ? Boolean(unlockTopic.test_passed) : false,
            completed_items: unlockTopic ? unlockTopic.completed_items : 0,
            required_items: t.items?.length || 1,
            items: (t.items ?? []).map((it, itIdx) => ({
              topic_item_id: it.topic_item_id,
              title: it.title,
              item_type: (it as any).kind || (it as any).item_type || "notes",
              position: it.position || itIdx + 1,
              required: it.required ?? true,
              completed: false,
              media_id: (it as any).media_id || null,
            })),
          };
        }),
      };
    });
  }, [unlockState, versionDetail]);

  // Set default expanded modules (all true)
  useEffect(() => {
    if (modulesList.length > 0 && Object.keys(expandedModules).length === 0) {
      const initial: Record<string, boolean> = {};
      modulesList.forEach((m) => {
        initial[m.module_id] = true;
      });
      setExpandedModules(initial);
    }
  }, [modulesList]);

  // Determine active topic
  const activeTopic = useMemo(() => {
    for (const m of modulesList) {
      for (const t of m.topics) {
        if (selectedTopicId && String(t.topic_id) === String(selectedTopicId)) return t;
      }
    }
    return modulesList[0]?.topics[0] || null;
  }, [modulesList, selectedTopicId]);

  // Determine active module
  const currentActiveModule = useMemo(() => {
    if (!activeTopic) return modulesList[0] || null;
    return (
      modulesList.find((m) => m.topics.some((t) => String(t.topic_id) === String(activeTopic.topic_id))) ||
      modulesList[0] ||
      null
    );
  }, [modulesList, activeTopic]);

  // Flattened topics for previous/next navigation
  const allTopics = useMemo(() => {
    return modulesList.flatMap((m) =>
      m.topics.map((t) => ({
        ...t,
        moduleId: m.module_id,
        moduleTitle: m.title,
        modulePosition: m.position,
      }))
    );
  }, [modulesList]);

  const currentTopicIndex = useMemo(() => {
    return allTopics.findIndex((t) => String(t.topic_id) === String(activeTopic?.topic_id));
  }, [allTopics, activeTopic?.topic_id]);

  const hasPrevLesson = currentTopicIndex > 0;
  const hasNextLesson = currentTopicIndex >= 0 && currentTopicIndex < allTopics.length - 1;
  const prevLesson = hasPrevLesson ? allTopics[currentTopicIndex - 1] : null;
  const nextLesson = hasNextLesson ? allTopics[currentTopicIndex + 1] : null;
  const isNextInNewModule = nextLesson && currentActiveModule && nextLesson.moduleId !== currentActiveModule.module_id;

  const handlePrevLessonClick = () => {
    if (prevLesson) {
      setSelectedTopicId(prevLesson.topic_id);
      setLeftContentView({ type: "lesson" });
    }
  };

  const handleNextLessonClick = () => {
    if (nextLesson) {
      setSelectedTopicId(nextLesson.topic_id);
      setLeftContentView({ type: "lesson" });
    }
  };

  const currentVideoItem = useMemo(() => {
    return activeTopic?.items?.find((it: any) => it.item_type === "video") || null;
  }, [activeTopic]);

  const currentPdfItem = useMemo(() => {
    return activeTopic?.items?.find((it: any) => it.item_type === "pdf") || null;
  }, [activeTopic]);

  const realVideoUrl = useMemo(() => {
    const mediaId = (currentVideoItem as any)?.media_id;
    if (mediaId) {
      return `${env.apiBaseUrl}/media/stream/${mediaId}`;
    }
    return null;
  }, [currentVideoItem]);

  // Helper: Calculate Chapter Completion Percentage
  const getChapterProgress = useCallback(
    (topic: any): number => {
      if (!topic) return 0;
      if (topic.completed || topic.test_passed) return 100;

      const key = String(topic.topic_id);
      const saved = videoProgressMap[key];
      if (saved) {
        if (saved.completed || (saved.percent ?? 0) >= 100) return 100;
        if (saved.percent > 0) return Math.min(100, saved.percent);
      }

      if (topic.required_items > 0 && topic.completed_items > 0) {
        if (topic.completed_items >= topic.required_items) return 100;
        return Math.min(100, Math.round((topic.completed_items / topic.required_items) * 100));
      }

      return 0;
    },
    [videoProgressMap]
  );

  // Helper: Calculate Module Completion Percentage
  const getModuleProgress = useCallback(
    (mod: any): number => {
      if (!mod || !mod.topics || mod.topics.length === 0) return 0;
      if (mod.completed || mod.test_passed) return 100;
      const sum = mod.topics.reduce((acc: number, t: any) => acc + getChapterProgress(t), 0);
      return Math.round(sum / mod.topics.length);
    },
    [getChapterProgress]
  );

  // Overall Course Progress
  const progressPercent = useMemo(() => {
    if (modulesList.length === 0) return 0;
    const sum = modulesList.reduce((acc, m) => acc + getModuleProgress(m), 0);
    return Math.round(sum / modulesList.length);
  }, [modulesList, getModuleProgress]);

  // Final Exam Status
  const finalStatus = useMemo(() => {
    if (!finalTestId) return "locked";

    const hasCompletedAttempt = finalAttemptsData?.items?.some(
      (a) => a.status === "graded" || a.result === "passed" || a.score !== null
    );
    if (
      hasCompletedAttempt ||
      (finalTestDetail?.best_percent != null &&
        finalTestDetail.best_percent >= (finalTestDetail?.pass_mark_percent ?? 70))
    ) {
      return "completed";
    }

    if (finalTestDetail?.open_attempt_id || finalAttemptsData?.items?.some((a) => a.status === "in_progress")) {
      return "in_progress";
    }

    const allModulesFinished =
      modulesList.length > 0 && modulesList.every((m) => m.completed || (m as any).test_passed || getModuleProgress(m) === 100);
    const isEligible = Boolean(unlockState?.eligible_for_final || finalTestDetail?.can_start || allModulesFinished);
    if (isEligible) {
      return "available";
    }

    return "locked";
  }, [finalTestId, finalAttemptsData, finalTestDetail, unlockState, modulesList, getModuleProgress]);

  // Certificate Data & Course Completion Evaluation
  const { data: certsData } = useListCertificatesQuery({ per_page: 50 });
  const [downloadCertMutation] = useGetCertificateDownloadMutation();
  const certificates = certsData?.items ?? [];
  const courseCertificate = useMemo(() => {
    return certificates.find((c) => String(c.course_id) === String(courseId));
  }, [certificates, courseId]);

  const isCourseCompleted =
    Boolean(courseCertificate) ||
    finalStatus === "completed" ||
    (modulesList.length > 0 && modulesList.every((m) => m.completed || (m as any).test_passed));

  // Restore video progress when switching chapters
  useEffect(() => {
    if (!activeTopic) return;
    const key = String(activeTopic.topic_id);
    const saved = videoProgressMap[key];
    if (saved && saved.currentTime > 0) {
      setCurrentTime(saved.currentTime);
      if (saved.duration) setDuration(saved.duration);
      if (videoRef.current) {
        videoRef.current.currentTime = saved.currentTime;
      }
    } else {
      setCurrentTime(0);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
      }
    }
    setIsPlaying(false);
  }, [activeTopic?.topic_id]);

  // Merge time intervals
  const mergeWatchedIntervals = useCallback((intervals: [number, number][]): [number, number][] => {
    if (!intervals || intervals.length === 0) return [];
    const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
    const first = sorted[0];
    if (!first) return [];
    const merged: [number, number][] = [[first[0], first[1]]];
    for (let i = 1; i < sorted.length; i++) {
      const item = sorted[i];
      if (!item) continue;
      const [currStart, currEnd] = item;
      const prev = merged[merged.length - 1];
      if (!prev) continue;
      if (currStart <= prev[1] + 1) {
        prev[1] = Math.max(prev[1], currEnd);
      } else {
        merged.push([currStart, currEnd]);
      }
    }
    return merged;
  }, []);

  const calculateUniqueWatched = useCallback((intervals: [number, number][]): number => {
    return intervals.reduce((acc, [start, end]) => acc + Math.max(0, end - start), 0);
  }, []);

  const lastTimeRef = useRef<number | null>(null);
  const isSeekingRef = useRef<boolean>(false);
  const saveProgressDebounced = useRef<NodeJS.Timeout | null>(null);

  // Monotonic Progress Persistence
  const persistProgress = useCallback(
    (timeSec: number, durSec: number, forceComplete = false) => {
      if (!activeTopic) return;
      const key = String(activeTopic.topic_id);

      if (saveProgressDebounced.current) {
        clearTimeout(saveProgressDebounced.current);
        saveProgressDebounced.current = null;
      }

      setVideoProgressMap((currentMap) => {
        let prev = currentMap[key];
        if (!prev) {
          try {
            const raw = localStorage.getItem(progressStorageKey);
            if (raw) {
              const parsed = JSON.parse(raw);
              prev = parsed[key];
            }
          } catch {}
        }

        const prevIntervals: [number, number][] = prev?.watchedIntervals ? [...prev.watchedIntervals] : [];
        const merged = mergeWatchedIntervals(prevIntervals);
        const totalWatchedSec = calculateUniqueWatched(merged);

        const effectiveDur = durSec > 0 ? durSec : (prev?.duration || duration || 600);
        const calculatedPct = effectiveDur > 0 ? Math.min(100, Math.round((totalWatchedSec / effectiveDur) * 100)) : 0;

        const isAlreadyCompleted = Boolean(
          prev?.completed ||
          (prev?.percent ?? 0) >= 100 ||
          activeTopic.completed ||
          (activeTopic as any).test_passed
        );
        const isDone = isAlreadyCompleted || forceComplete || calculatedPct >= 90;

        const record: SavedVideoProgress = {
          currentTime: Math.floor(timeSec),
          duration: Math.floor(effectiveDur),
          percent: isDone ? 100 : Math.max(prev?.percent || 0, calculatedPct),
          completed: isDone,
          watchedIntervals: merged,
          updatedAt: new Date().toISOString(),
        };

        const updated = { ...currentMap, [key]: record };
        try {
          localStorage.setItem(progressStorageKey, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // Synchronize with backend database whenever completed and enrolled
      if (enrollment?.enrollment_id && activeTopic) {
        const requiredItems = activeTopic.items?.filter((it: any) => it.required) || [];
        if (forceComplete) {
          requiredItems.forEach((it: any) => {
            completeItemMutation({
              enrollmentId: enrollment.enrollment_id,
              topicItemId: it.topic_item_id,
            }).catch(() => {});
          });
        } else if (currentVideoItem?.topic_item_id) {
          const effectiveDur = durSec > 0 ? durSec : duration;
          if (timeSec >= effectiveDur * 0.9) {
            completeItemMutation({
              enrollmentId: enrollment.enrollment_id,
              topicItemId: currentVideoItem.topic_item_id,
            }).catch(() => {});
          }
        }
      }
    },
    [
      activeTopic,
      progressStorageKey,
      mergeWatchedIntervals,
      calculateUniqueWatched,
      duration,
      enrollment?.enrollment_id,
      currentVideoItem?.topic_item_id,
      completeItemMutation,
    ]
  );

  // Time update listener
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration || duration || 600;
    setCurrentTime(cur);

    if (activeTopic) {
      const key = String(activeTopic.topic_id);
      if (!isSeekingRef.current && isPlaying && lastTimeRef.current !== null) {
        const delta = cur - lastTimeRef.current;
        if (delta > 0 && delta <= 3) {
          setVideoProgressMap((currentMap) => {
            let prev = currentMap[key];
            if (!prev) {
              try {
                const raw = localStorage.getItem(progressStorageKey);
                if (raw) {
                  prev = JSON.parse(raw)[key];
                }
              } catch {}
            }
            const isDone = Boolean(
              prev?.completed ||
              (prev?.percent ?? 0) >= 100 ||
              activeTopic.completed ||
              (activeTopic as any).test_passed
            );
            const intervals: [number, number][] = [
              ...(prev?.watchedIntervals || []),
              [lastTimeRef.current!, cur],
            ];
            const merged = mergeWatchedIntervals(intervals);
            const watchedSec = calculateUniqueWatched(merged);
            const calculatedPct = dur > 0 ? Math.min(100, Math.round((watchedSec / dur) * 100)) : 0;
            const nextDone = isDone || calculatedPct >= 90;
            const nextRecord: SavedVideoProgress = {
              currentTime: Math.floor(cur),
              duration: Math.floor(dur),
              percent: nextDone ? 100 : Math.max(prev?.percent || 0, calculatedPct),
              completed: nextDone,
              watchedIntervals: merged,
              updatedAt: new Date().toISOString(),
            };
            const nextMap = { ...currentMap, [key]: nextRecord };
            try {
              localStorage.setItem(progressStorageKey, JSON.stringify(nextMap));
            } catch {}
            return nextMap;
          });
        }
      }
    }
    lastTimeRef.current = cur;

    if (saveProgressDebounced.current) clearTimeout(saveProgressDebounced.current);
    saveProgressDebounced.current = setTimeout(() => {
      persistProgress(cur, dur);
    }, 1500);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (dur && !isNaN(dur) && dur > 0) {
      setDuration(dur);
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    lastTimeRef.current = null;
    if (saveProgressDebounced.current) {
      clearTimeout(saveProgressDebounced.current);
      saveProgressDebounced.current = null;
    }
    const dur = videoRef.current?.duration || duration || 600;
    persistProgress(dur, dur, true);
    if (enrollment?.enrollment_id && activeTopic) {
      const itemsToComplete = activeTopic.items?.filter((it: any) => it.required) || [];
      itemsToComplete.forEach((it: any) => {
        completeItemMutation({
          enrollmentId: enrollment.enrollment_id,
          topicItemId: it.topic_item_id,
        }).catch(() => {});
      });
    }
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      lastTimeRef.current = null;
      persistProgress(videoRef.current.currentTime, videoRef.current.duration || duration);
    } else {
      lastTimeRef.current = videoRef.current.currentTime;
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTo = Number(e.target.value);
    isSeekingRef.current = true;
    lastTimeRef.current = seekTo;
    setCurrentTime(seekTo);
    if (videoRef.current) {
      videoRef.current.currentTime = seekTo;
    }
    persistProgress(seekTo, duration);
    setTimeout(() => {
      isSeekingRef.current = false;
    }, 200);
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    const nextMute = !isMuted;
    videoRef.current.muted = nextMute;
    setIsMuted(nextMute);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      if (val === 0) {
        setIsMuted(true);
        videoRef.current.muted = true;
      } else if (isMuted) {
        setIsMuted(false);
        videoRef.current.muted = false;
      }
    }
  };

  // Close video quality dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target as Node)) {
        setIsQualityMenuOpen(false);
      }
    };
    if (isQualityMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isQualityMenuOpen]);

  // Video Quality Switching with In-Playback Preservation
  const handleQualityChange = (targetQuality: VideoQuality) => {
    if (targetQuality === videoQuality) {
      setIsQualityMenuOpen(false);
      return;
    }

    const vid = videoRef.current;
    const savedTime = vid ? vid.currentTime : currentTime;
    const wasPlaying = vid ? !vid.paused : isPlaying;
    const savedRate = vid ? vid.playbackRate : playbackRate;

    setVideoQuality(targetQuality);
    setIsQualityMenuOpen(false);

    const targetOpt = QUALITY_OPTIONS.find((o) => o.id === targetQuality) ?? QUALITY_OPTIONS[0]!;
    const targetSrc = realVideoUrl || (activeTopic as any)?.media_url || targetOpt.src;

    if (vid) {
      if (vid.src !== targetSrc) {
        vid.src = targetSrc;
        const onLoaded = () => {
          vid.currentTime = savedTime;
          vid.playbackRate = savedRate;
          if (wasPlaying) {
            vid.play().catch(() => {});
          }
          vid.removeEventListener("loadeddata", onLoaded);
        };
        vid.addEventListener("loadeddata", onLoaded);
        vid.currentTime = savedTime;
        vid.playbackRate = savedRate;
        if (wasPlaying) {
          vid.play().catch(() => {});
        }
      }
    }

    notify.info(`Video resolution switched to ${targetQuality} (${targetOpt.resolution})`);
  };

  // Synchronize video player source when switching chapters or when media URL loads
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const targetOpt = QUALITY_OPTIONS.find((o) => o.id === videoQuality) ?? QUALITY_OPTIONS[0]!;
    const nextSrc = realVideoUrl || (activeTopic as any)?.media_url || targetOpt.src;
    if (vid.src !== nextSrc) {
      vid.src = nextSrc;
      vid.load();
    }
  }, [realVideoUrl, videoQuality, activeTopic?.topic_id]);

  // Fullscreen Handler for Player Container
  const handleFullscreen = () => {
    const el = playerContainerRef.current || videoRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) {
        el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Draggable Split Panel Effect
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      let pct = (offsetX / rect.width) * 100;
      if (pct < 45) pct = 45;
      if (pct > 78) pct = 78;
      setLeftWidthPct(pct);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      try {
        localStorage.setItem("examlms_learning_split_pct", String(leftWidthPct));
      } catch {}
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, leftWidthPct]);

  // Lesson completion toggle
  const activeChapterProgress = getChapterProgress(activeTopic);
  const isLessonCompleted = activeChapterProgress === 100;

  const handleMarkCompleted = async () => {
    if (!enrollment?.enrollment_id) {
      notify.error("Course enrollment required. You must be actively enrolled in this course to save progress.");
      return;
    }
    if (saveProgressDebounced.current) {
      clearTimeout(saveProgressDebounced.current);
      saveProgressDebounced.current = null;
    }
    const dur = duration > 0 ? duration : 600;
    persistProgress(dur, dur, true);

    const itemsToComplete = activeTopic?.items?.filter((it: any) => it.required) || [];
    if (itemsToComplete.length > 0) {
      try {
        await Promise.all(
          itemsToComplete.map((it: any) =>
            completeItemMutation({
              enrollmentId: enrollment.enrollment_id,
              topicItemId: it.topic_item_id,
            }).unwrap().catch(() => {})
          )
        );
        notify.success("Lesson completed! Progress saved and chapter test unlocked.");
      } catch {
        notify.success("Progress saved.");
      }
    } else {
      notify.success("Lesson completed! Progress saved.");
    }
  };

  const handleAssessmentPassed = async (chapterOrModuleId?: string) => {
    notify.success("Assessment Passed! Progression unlocked.");
    if (enrollment?.enrollment_id && chapterOrModuleId) {
      try {
        await completeItemMutation({
          enrollmentId: enrollment.enrollment_id,
          topicItemId: chapterOrModuleId,
        }).unwrap();
      } catch {}
    }
    refetchUnlockState?.();
    refetchEnrollments?.();
    refetchMyCourses?.();
  };

  const handleStartChapterTest = () => {
    if (!activeTopic) return;
    const testId = (activeTopic as any)?.topic_test_id;
    if (!testId) {
      notify.info("No chapter quiz configured for this lesson.");
      return;
    }
    setLeftContentView({
      type: "chapter_test",
      testId,
      chapterTitle: activeTopic.title,
      chapterId: activeTopic.topic_id,
      moduleId: currentActiveModule?.module_id || "",
    });
  };

  const handleFinalTestClick = () => {
    if (!finalTestId) return;
    if (finalStatus === "locked") {
      notify.info("Prerequisites not completed. Finish all course modules and tests to take the final certification exam.");
      return;
    }
    setLeftContentView({ type: "final_exam" });
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // NOTES STORAGE & ACTIONS (scoped per student, course, and lesson)
  const notesStorageKey = useMemo(() => {
    const studentId = user?.user_id || "guest";
    const topicId = activeTopic?.topic_id || "general";
    return `examlms_notes_${studentId}_${courseId}_${topicId}`;
  }, [user?.user_id, courseId, activeTopic?.topic_id]);

  const [notesList, setNotesList] = useState<LessonNote[]>(() => {
    try {
      const studentId = user?.user_id || "guest";
      const topicId = activeTopic?.topic_id || "general";
      const raw = localStorage.getItem(`examlms_notes_${studentId}_${courseId}_${topicId}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  // Reload notes when active lesson changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(notesStorageKey);
      if (raw) {
        setNotesList(JSON.parse(raw));
      } else {
        setNotesList([]);
      }
    } catch {
      setNotesList([]);
    }
  }, [notesStorageKey]);

  const handleSaveNote = () => {
    if (!newNoteText.trim()) return;
    const noteTime = noteIncludeTimestamp ? Math.floor(currentTime) : 0;
    const newNote: LessonNote = {
      id: "note_" + Date.now(),
      timestamp: noteTime,
      timestampFormatted: formatTime(noteTime),
      text: newNoteText.trim(),
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    const updated = [newNote, ...notesList];
    setNotesList(updated);
    try {
      localStorage.setItem(notesStorageKey, JSON.stringify(updated));
    } catch {}
    setNewNoteText("");
    notify.success("Note saved successfully.");
  };

  const handleDeleteNote = (id: string) => {
    const updated = notesList.filter((n) => n.id !== id);
    setNotesList(updated);
    try {
      localStorage.setItem(notesStorageKey, JSON.stringify(updated));
    } catch {}
  };

  const handleSeekToTimestamp = (sec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = sec;
      setCurrentTime(sec);
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      notify.info(`Jumped to ${formatTime(sec)}`);
    }
  };

  // DISCUSSION STORAGE & ACTIONS (scoped per course and lesson)
  const discussionStorageKey = useMemo(() => {
    const topicId = activeTopic?.topic_id || "general";
    return `examlms_discussion_${courseId}_${topicId}`;
  }, [courseId, activeTopic?.topic_id]);

  const [commentsList, setCommentsList] = useState<DiscussionComment[]>(() => {
    try {
      const topicId = activeTopic?.topic_id || "general";
      const raw = localStorage.getItem(`examlms_discussion_${courseId}_${topicId}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [
      {
        id: "seed_1",
        author: "Alex Morgan",
        role: "Student",
        text: "Make sure to review the framework breakdown at 02:40, it really clarifies the core logic!",
        createdAt: "2 days ago",
        likes: 4,
      },
      {
        id: "seed_2",
        author: "Sarah Chen, TA",
        role: "Teaching Assistant",
        text: "Feel free to post questions here. We'll be answering all implementation queries within 24 hours.",
        createdAt: "Yesterday",
        likes: 7,
      },
    ];
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(discussionStorageKey);
      if (raw) {
        setCommentsList(JSON.parse(raw));
      } else {
        setCommentsList([
          {
            id: "seed_1",
            author: "Alex Morgan",
            role: "Student",
            text: "Make sure to review the framework breakdown at 02:40, it really clarifies the core logic!",
            createdAt: "2 days ago",
            likes: 4,
          },
          {
            id: "seed_2",
            author: "Sarah Chen, TA",
            role: "Teaching Assistant",
            text: "Feel free to post questions here. We'll be answering all implementation queries within 24 hours.",
            createdAt: "Yesterday",
            likes: 7,
          },
        ]);
      }
    } catch {}
  }, [discussionStorageKey]);

  const handlePostComment = () => {
    if (!newCommentText.trim()) return;
    const newComment: DiscussionComment = {
      id: "comment_" + Date.now(),
      author: user?.full_name || "You",
      role: "Student",
      text: newCommentText.trim(),
      createdAt: "Just now",
      likes: 0,
    };
    const updated = [newComment, ...commentsList];
    setCommentsList(updated);
    try {
      localStorage.setItem(discussionStorageKey, JSON.stringify(updated));
    } catch {}
    setNewCommentText("");
    notify.success("Question posted to lesson discussion.");
  };

  const handleToggleLike = (id: string) => {
    const updated = commentsList.map((c) =>
      c.id === id ? { ...c, likes: c.likes + 1 } : c
    );
    setCommentsList(updated);
    try {
      localStorage.setItem(discussionStorageKey, JSON.stringify(updated));
    } catch {}
  };

  // Loading States
  if (isCourseLoading || (versionId && isVersionLoading)) {
    return <PageLoader label="Loading your learning room..." />;
  }

  if (isCourseError || (!isCourseLoading && !course)) {
    const backLabel = isExternalStudent ? "Browse courses" : isInstitutionStudent ? "Browse licensed courses" : "Back to My Courses";
    const backTo = isExternalStudent || isInstitutionStudent ? "/courses" : "/courses/my";
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-slate-200 font-sans">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Course Not Available</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            {isExternalStudent
              ? "Purchase this course from the catalog to open the learning room."
              : isInstitutionStudent
              ? "This course is not on your university license. Open Browse courses to see what you can study."
              : "You need an active enrollment or license before opening this course."}
          </p>
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="w-full py-3 rounded-xl bg-[#7DC8F7] hover:bg-[#5CB8EC] text-white font-bold text-sm transition-colors cursor-pointer"
          >
            {backLabel}
          </button>
        </div>
      </div>
    );
  }

  if (!publishedVersion) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-slate-200 font-sans">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Curriculum Not Published</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            This course does not have a published curriculum version available yet. Students can only access published courses.
          </p>
          <button
            type="button"
            onClick={() => navigate("/courses/my")}
            className="w-full py-3 rounded-xl bg-[#7DC8F7] hover:bg-[#5CB8EC] text-white font-bold text-sm transition-colors cursor-pointer"
          >
            Back to My Courses
          </button>
        </div>
      </div>
    );
  }

  if (isEnrollmentsLoading) {
    return <PageLoader label="Loading your learning room..." />;
  }

  const courseTitle = course?.title || "Course";

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 font-sans flex flex-col gap-3 pb-12 select-none">
      {/* ============================================================ */}
      {/* 1. TOP NAVIGATION HEADER (Matching Reference UI Exactly) */}
      {/* ============================================================ */}
      <header className="flex items-center justify-between gap-4 py-2.5 px-4 mb-3 rounded-2xl bg-white border border-slate-200 shadow-lg">
        {/* Left: Close/Back button & Breadcrumbs */}
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            type="button"
            onClick={() => navigate("/courses/my")}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shrink-0 border border-slate-200"
            title="Exit Learning Room"
          >
            <X size={16} />
          </button>

          <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 truncate">
            <Link to="/courses/my" className="hover:text-brand-600 transition-colors shrink-0">
              Learn
            </Link>
            <ChevronRight size={13} className="text-slate-400 shrink-0" />
            <Link to={`/courses/${courseId}/details`} className="hover:text-brand-600 transition-colors truncate max-w-[180px] sm:max-w-[280px]">
              {courseTitle}
            </Link>
            <ChevronRight size={13} className="text-slate-400 shrink-0" />
            <span className="text-slate-900 font-semibold truncate max-w-[180px] sm:max-w-[320px]">
              {leftContentView.type === "chapter_test"
                ? `Quiz: ${leftContentView.chapterTitle}`
                : leftContentView.type === "module_test"
                ? `Assessment: ${leftContentView.moduleTitle}`
                : leftContentView.type === "final_exam"
                ? "Final Certification Exam"
                : leftContentView.type === "certificate"
                ? "Course Certificate"
                : activeTopic?.title || "Lesson"}
            </span>
          </nav>
        </div>

        {/* Right: Notes shortcut, Progress Pill, Previous / Next Lesson */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Notes toggle icon */}
          <button
            type="button"
            onClick={() => {
              setActiveSidebarTab("notes");
              setIsMobileSidebarOpen(true);
            }}
            className={cn(
              "p-2 rounded-lg transition-colors cursor-pointer border",
              activeSidebarTab === "notes"
                ? "bg-[#7DC8F7]/20 text-[#7DC8F7] border-[#7DC8F7]/40"
                : "bg-slate-100 text-slate-500 hover:text-slate-900 border-slate-200 hover:bg-slate-200"
            )}
            title="Lesson Notes"
          >
            <Edit3 size={15} />
          </button>

          {/* Overall Progress Circular / Pill Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] text-xs font-bold shadow-xs">
            <CheckCircle2 size={13} className="text-[#10B981]" />
            <span>{progressPercent}%</span>
          </div>

          {/* Previous Lesson Button */}
          <button
            type="button"
            disabled={!hasPrevLesson}
            onClick={handlePrevLessonClick}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none text-slate-600 hover:text-slate-900 transition-colors cursor-pointer border border-slate-200"
            title={prevLesson ? `Previous: ${prevLesson.title}` : "Previous Lesson"}
          >
            <ChevronLeft size={16} />
          </button>

          {/* Next Lesson / Next Module Pill Button */}
          <button
            type="button"
            disabled={!hasNextLesson}
            onClick={handleNextLessonClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-slate-900 font-bold text-xs hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-sm cursor-pointer"
            title={nextLesson ? `Next: ${nextLesson.title}` : "Next Lesson"}
          >
            <span>{isNextInNewModule ? "Next module" : "Next lesson"}</span>
            <ChevronRight size={14} />
          </button>

          {/* Mobile Curriculum Sidebar Toggle */}
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
            className="lg:hidden p-2 rounded-lg bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 cursor-pointer"
          >
            {isMobileSidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. TWO-COLUMN MAIN CONTAINER (Resizable / Responsive) */}
      {/* ============================================================ */}
      <div ref={containerRef} className="flex-1 flex flex-col lg:flex-row gap-0 relative items-stretch">
        {/* ========================================================== */}
        {/* LEFT COLUMN: Main Learning Area (Video Player / Test Runner) */}
        {/* ========================================================== */}
        <div
          style={{ width: undefined }}
          className={cn(
            "w-full transition-all duration-75 flex flex-col rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden",
            "lg:min-w-[460px]"
          )}
          ref={(node) => {
            if (node && window.innerWidth >= 1024) {
              node.style.width = `${leftWidthPct}%`;
            } else if (node) {
              node.style.width = "100%";
            }
          }}
        >
          {/* IN-PLACE ASSESSMENT: CHAPTER TEST */}
          {leftContentView.type === "chapter_test" ? (
            <div className="flex flex-col h-full min-h-[620px] bg-white">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setLeftContentView({ type: "lesson" })}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"
                >
                  <ChevronLeft size={16} /> Return to Video Lecture
                </button>
                <span className="text-xs font-semibold text-slate-300">
                  Chapter Quiz: <b className="text-slate-900">{leftContentView.chapterTitle}</b>
                </span>
              </div>
              <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
                <StudentAssessmentRunner
                  testId={leftContentView.testId}
                  testTitle={`${leftContentView.chapterTitle} - Quiz`}
                  courseId={courseId ?? ""}
                  courseTitle={course?.title ?? "Course"}
                  contextTitle={leftContentView.chapterTitle}
                  contextType="chapter"
                  parentModuleId={leftContentView.moduleId}
                  passMarkPercent={70}
                  onTestPassed={() => handleAssessmentPassed(leftContentView.chapterId)}
                  returnUrl={`/courses/${courseId}/learn`}
                />
              </div>
            </div>
          ) : leftContentView.type === "module_test" ? (
            /* IN-PLACE ASSESSMENT: MODULE TEST */
            <div className="flex flex-col h-full min-h-[620px] bg-white">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setLeftContentView({ type: "lesson" })}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"
                >
                  <ChevronLeft size={16} /> Return to Video Lecture
                </button>
                <span className="text-xs font-semibold text-slate-300">
                  Module Assessment: <b className="text-slate-900">{leftContentView.moduleTitle}</b>
                </span>
              </div>
              <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
                <StudentAssessmentRunner
                  testId={leftContentView.testId}
                  testTitle={`${leftContentView.moduleTitle} - Assessment`}
                  courseId={courseId ?? ""}
                  courseTitle={course?.title ?? "Course"}
                  contextTitle={leftContentView.moduleTitle}
                  contextType="module"
                  parentModuleId={leftContentView.moduleId}
                  passMarkPercent={70}
                  onTestPassed={() => handleAssessmentPassed(leftContentView.moduleId)}
                  returnUrl={`/courses/${courseId}/learn`}
                />
              </div>
            </div>
          ) : leftContentView.type === "final_exam" ? (
            /* IN-PLACE ASSESSMENT: FINAL EXAM */
            <div className="flex flex-col h-full min-h-[620px] bg-white">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setLeftContentView({ type: "lesson" })}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"
                >
                  <ChevronLeft size={16} /> Return to Video Lecture
                </button>
                <span className="text-xs font-semibold text-slate-300">
                  Proctored Assessment: <b className="text-slate-900">{finalTestDetail?.title || "Final Certification Exam"}</b>
                </span>
              </div>
              <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
                <StudentAssessmentRunner
                  testId={String(finalTestId)}
                  testTitle={finalTestDetail?.title || "Final Certification Exam"}
                  courseId={courseId ?? ""}
                  courseTitle={course?.title ?? "Course"}
                  contextTitle="Final Certification Exam"
                  contextType="module"
                  parentModuleId={modulesList[0]?.module_id ?? ""}
                  passMarkPercent={finalTestDetail?.pass_mark_percent ?? 70}
                  onTestPassed={() => {
                    refetchEnrollments();
                    refetchUnlockState();
                  }}
                  returnUrl={`/courses/${courseId}/learn`}
                />
              </div>
            </div>
          ) : leftContentView.type === "certificate" ? (
            /* IN-PLACE CERTIFICATE VIEW */
            <div className="flex flex-col h-full min-h-[620px] bg-white">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setLeftContentView({ type: "lesson" })}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"
                >
                  <ChevronLeft size={16} /> Return to Video Lecture
                </button>
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Verified Academic Credential
                </span>
              </div>
              <div className="p-6 sm:p-8 flex-1 overflow-y-auto flex flex-col items-center justify-center">
                <div className="max-w-xl w-full rounded-2xl border-4 border-[#7DC8F7] bg-white p-8 text-center text-slate-900 shadow-2xl space-y-4">
                  <div className="text-[11px] uppercase font-bold tracking-widest text-[#7DC8F7]">
                    ExamLMS Credential Verification
                  </div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Certificate of Completion
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {courseCertificate?.student_name || user?.full_name || "Student"}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    has successfully satisfied all learning modules, required topics, and examination criteria for
                  </p>
                  <h4 className="text-xl font-bold text-[#7DC8F7]">{courseCertificate?.course_title || courseTitle}</h4>
                  <div className="text-xs text-slate-600 font-medium">
                    Grade: <b>{courseCertificate?.grade || "Passed with Distinction"}</b> · Issued:{" "}
                    {courseCertificate?.issued_at
                      ? new Date(courseCertificate.issued_at).toLocaleDateString()
                      : new Date().toLocaleDateString()}
                  </div>
                  <div className="inline-block text-[11px] font-mono text-slate-600 bg-slate-100 py-1 px-3 rounded-md border border-slate-300">
                    ID: {courseCertificate?.verification_code || "EXAMLMS-CERT-VERIFIED"}
                  </div>
                  <div className="pt-4 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        if (courseCertificate?.certificate_id) {
                          try {
                            const res = await downloadCertMutation(courseCertificate.certificate_id).unwrap();
                            if (res.url) window.open(res.url, "_blank");
                          } catch {
                            window.print();
                          }
                        } else {
                          window.print();
                        }
                      }}
                      className="px-5 py-2.5 rounded-xl bg-[#7DC8F7] text-white text-xs font-bold hover:bg-[#5CB8EC] cursor-pointer shadow-md flex items-center gap-2"
                    >
                      <Download size={15} /> Download PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* STANDARD LESSON: 16:9 VIDEO PLAYER & BELOW-PLAYER CONTENT */
            <>
              {/* 16:9 VIDEO CONTAINER */}
              <div
                ref={playerContainerRef}
                className="aspect-video bg-black relative overflow-hidden flex flex-col justify-between group select-none"
              >
                {/* HTML5 Video Element */}
                <video
                  ref={videoRef}
                  src={realVideoUrl || (QUALITY_OPTIONS.find((q) => q.id === videoQuality) || QUALITY_OPTIONS[0]!).src}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={handleVideoEnded}
                  className="w-full h-full object-contain cursor-pointer"
                  onClick={handlePlayPause}
                  playsInline
                />

                {/* Top Video Overlay (Watermark & Active Quality Badge) */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
                  <span className="px-3 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1.5 shadow-md">
                    <BookOpen size={14} className="text-[#7DC8F7]" />
                    <span>{activeTopic?.title || "Course Lesson"}</span>
                  </span>

                  <span className="px-2.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white/90 text-[10px] font-mono tracking-wider flex items-center gap-1.5 border border-white/10 shadow-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                    {QUALITY_OPTIONS.find((q) => q.id === videoQuality)?.badge || "1080p FHD"}
                  </span>
                </div>

                {/* Big Center Play Overlay (when paused) */}
                {!isPlaying && (
                  <div
                    onClick={handlePlayPause}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer transition-opacity z-10"
                  >
                    <div className="w-16 h-16 rounded-full bg-white/95 text-slate-900 flex items-center justify-center hover:scale-110 transition-transform shadow-2xl">
                      <Play size={28} className="translate-x-0.5 fill-slate-900" />
                    </div>
                  </div>
                )}

                {/* Bottom Video Controls Toolbar */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-3 pt-8 flex flex-col gap-2 opacity-95 group-hover:opacity-100 transition-opacity z-10">
                  {/* Timeline Scrubber */}
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-[#7DC8F7] hover:h-2 transition-all"
                    />
                  </div>

                  {/* Controls Row */}
                  <div className="flex items-center justify-between text-white text-xs">
                    {/* Left: Play/Pause, Rewind, Forward, Volume, Time */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handlePlayPause}
                        className="p-1 rounded hover:bg-white/20 transition-colors cursor-pointer"
                        title={isPlaying ? "Pause" : "Play"}
                      >
                        {isPlaying ? <Pause size={18} /> : <Play size={18} className="fill-white" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                          }
                        }}
                        className="p-1 rounded hover:bg-white/20 transition-colors cursor-pointer"
                        title="Rewind 10s"
                      >
                        <RotateCcw size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
                          }
                        }}
                        className="p-1 rounded hover:bg-white/20 transition-colors cursor-pointer"
                        title="Forward 10s"
                      >
                        <RotateCw size={15} />
                      </button>

                      <div className="flex items-center gap-1.5 group/vol">
                        <button
                          type="button"
                          onClick={handleToggleMute}
                          className="p-1 rounded hover:bg-white/20 transition-colors cursor-pointer"
                        >
                          {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="w-16 h-1 bg-white/30 rounded-full appearance-none cursor-pointer accent-white"
                          title="Volume"
                        />
                      </div>

                      <span className="font-mono text-[11px] text-white/90">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>

                    {/* Right: Playback Speed, Video Quality, Fullscreen */}
                    <div className="flex items-center gap-2">
                      {/* Speed */}
                      <select
                        value={playbackRate}
                        onChange={(e) => {
                          const rate = Number(e.target.value);
                          setPlaybackRate(rate);
                          if (videoRef.current) videoRef.current.playbackRate = rate;
                        }}
                        className="bg-black/50 hover:bg-black/70 border border-white/20 text-white text-[11px] font-semibold rounded px-1.5 py-0.5 cursor-pointer outline-none transition-colors"
                        title="Playback Speed"
                      >
                        <option value={0.75} className="bg-slate-900 text-white">0.75x</option>
                        <option value={1} className="bg-slate-900 text-white">1.0x</option>
                        <option value={1.25} className="bg-slate-900 text-white">1.25x</option>
                        <option value={1.5} className="bg-slate-900 text-white">1.5x</option>
                        <option value={2} className="bg-slate-900 text-white">2.0x</option>
                      </select>

                      {/* Video Quality Selector */}
                      <div ref={qualityMenuRef} className="relative">
                        <button
                          type="button"
                          onClick={() => setIsQualityMenuOpen((prev) => !prev)}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border cursor-pointer transition-colors shadow-xs",
                            isQualityMenuOpen
                              ? "bg-[#7DC8F7] border-[#7DC8F7] text-white"
                              : "bg-black/50 hover:bg-black/70 border-white/20 text-white"
                          )}
                          title="Video Resolution Settings"
                        >
                          <Settings2 size={13} className={isQualityMenuOpen ? "text-white" : "text-slate-300"} />
                          <span>{videoQuality}</span>
                          <ChevronDown size={11} className={cn("transition-transform duration-150", isQualityMenuOpen && "rotate-180")} />
                        </button>

                        {/* Quality Dropdown Menu */}
                        {isQualityMenuOpen && (
                          <div className="absolute right-0 bottom-full mb-2 w-56 rounded-xl bg-slate-950/95 border border-slate-700/80 shadow-2xl p-1.5 backdrop-blur-md z-30 space-y-0.5 text-left">
                            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 flex items-center justify-between">
                              <span>Video Quality</span>
                              <span className="text-[#7DC8F7] font-mono text-[9px]">High Definition</span>
                            </div>

                            {QUALITY_OPTIONS.map((opt) => {
                              const isSelected = opt.id === videoQuality;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => handleQualityChange(opt.id)}
                                  className={cn(
                                    "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer group",
                                    isSelected
                                      ? "bg-[#7DC8F7]/25 text-[#A8DDF8] font-bold border border-[#7DC8F7]/30"
                                      : "text-slate-200 hover:bg-white/10"
                                  )}
                                >
                                  <div className="min-w-0 pr-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className={cn("font-bold text-xs", isSelected ? "text-[#A8DDF8]" : "text-white")}>
                                        {opt.label}
                                      </span>
                                      {opt.id === "Auto" && (
                                        <span className="text-[9px] bg-slate-800 text-slate-300 px-1 py-0.2 rounded font-normal">
                                          Auto
                                        </span>
                                      )}
                                      {opt.id === "2040p" && (
                                        <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 py-0.2 rounded font-bold">
                                          4K
                                        </span>
                                      )}
                                      {opt.id === "1080p" && (
                                        <span className="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1 py-0.2 rounded font-semibold">
                                          FHD
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                                      {opt.resolution}
                                    </span>
                                  </div>
                                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                    {isSelected ? <Check size={14} className="text-[#A8DDF8]" /> : null}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Fullscreen */}
                      <button
                        type="button"
                        onClick={handleFullscreen}
                        className="p-1 rounded hover:bg-white/20 transition-colors cursor-pointer text-white"
                        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                      >
                        <Maximize2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ====================================================== */}
              {/* BELOW-VIDEO LESSON INFORMATION & MARK AS COMPLETE */}
              {/* ====================================================== */}
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Lesson Meta & Title */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Module {currentActiveModule?.position || 1}: {currentActiveModule?.title || "Core Learning"}
                    </span>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                      {activeTopic?.title || "Lesson"}
                    </h2>
                    <div className="flex items-center gap-3 text-xs text-slate-400 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock size={13} className="text-slate-500" />
                        {duration > 0 ? formatTime(duration) : "10:00"} mins
                      </span>
                      <span>·</span>
                      <span>Instructor: {(course as any)?.instructor_name || "ExamLMS Faculty"}</span>
                      <span>·</span>
                      <span className="text-slate-400">
                        Watch progress: <b className="text-emerald-400">{activeChapterProgress}%</b>
                      </span>
                    </div>
                  </div>

                  {/* Mark as Complete Button & Chapter Quiz Button */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      disabled={isCompleting}
                      onClick={handleMarkCompleted}
                      className={cn(
                        "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-md",
                        isLessonCompleted
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                          : "bg-[#7DC8F7] hover:bg-[#5CB8EC] text-white shadow-[#7DC8F7]/30"
                      )}
                    >
                      <Check size={16} className={isLessonCompleted ? "text-emerald-400" : "text-white"} />
                      <span>{isLessonCompleted ? "Completed" : "Mark as Complete"}</span>
                    </button>

                    {/* Chapter quiz shortcut if present */}
                    {(activeTopic as any)?.topic_test_id && (
                      <button
                        type="button"
                        onClick={handleStartChapterTest}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                        title="Take chapter quiz"
                      >
                        <Award size={14} className="text-[#7DC8F7]" />
                        <span>Quiz</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ====================================================== */}
              {/* BELOW-VIDEO TABS: Description | Resources | Discussion */}
              {/* ====================================================== */}
              <div className="flex border-b border-slate-200 px-5 gap-6 bg-white">
                {(["description", "resources", "discussion"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveLessonTab(tab)}
                    className={cn(
                      "py-3 text-xs font-bold transition-all relative capitalize cursor-pointer",
                      activeLessonTab === tab
                        ? "text-slate-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#7DC8F7]"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    {tab === "description" ? "Description" : tab === "resources" ? "Resources" : "Discussion"}
                  </button>
                ))}
              </div>

              {/* TAB CONTENT PANEL */}
              <div className="p-5 text-xs text-slate-600 min-h-[160px] leading-relaxed flex-1 bg-white">
                {/* 1. DESCRIPTION TAB */}
                {activeLessonTab === "description" && (
                  <div className="space-y-3 max-w-3xl">
                    <h4 className="font-bold text-slate-900 text-sm">About this lesson</h4>
                    <p className="text-slate-400 leading-relaxed">
                      In this lesson, you will master the principles and techniques of <b>{activeTopic?.title || "this chapter"}</b>.
                      Follow along with the video, review key definitions and frameworks, and complete the chapter quiz to proceed to the next module.
                    </p>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <b className="text-slate-900 block font-bold">Key Learning Objectives:</b>
                      <ul className="list-disc pl-5 space-y-1 text-slate-400">
                        <li>Understand the core design patterns and architecture covered in this chapter.</li>
                        <li>Learn best practices for scaling, state management, and real-world system resilience.</li>
                        <li>Apply these principles to hands-on case studies and assessments.</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* 2. RESOURCES TAB */}
                {activeLessonTab === "resources" && (
                  <div className="space-y-3 max-w-3xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#7DC8F7]/15 text-[#A8DDF8] flex items-center justify-center shrink-0">
                          <FileText size={20} />
                        </div>
                        <div>
                          <b className="text-xs text-slate-900 block">
                            {currentPdfItem?.title || `${activeTopic?.title || "Chapter"} - Reference Slides.pdf`}
                          </b>
                          <span className="text-[11px] text-slate-400">
                            {(currentPdfItem as any)?.media_id ? "Uploaded Chapter Document · PDF Format" : "Official instructor slides · 18 pages · Updated"}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsPdfViewerOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7DC8F7] hover:bg-[#5CB8EC] text-xs font-bold text-white transition-colors cursor-pointer shrink-0 shadow-sm"
                      >
                        <Eye size={15} /> View PDF
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. DISCUSSION TAB */}
                {activeLessonTab === "discussion" && (
                  <div className="space-y-4 max-w-3xl">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 text-sm">Lesson Q&amp;A &amp; Discussion</h4>
                      <span className="text-xs text-slate-500">{commentsList.length} questions &amp; thoughts</span>
                    </div>

                    {/* New Comment Input */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <textarea
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        placeholder="Ask a question or share a thought about this lesson..."
                        rows={2}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-[#7DC8F7] resize-none"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handlePostComment}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#7DC8F7] hover:bg-[#5CB8EC] text-white font-bold text-xs transition-colors cursor-pointer"
                        >
                          <Send size={13} /> Post Question
                        </button>
                      </div>
                    </div>

                    {/* Comments List */}
                    <div className="space-y-2.5">
                      {commentsList.map((c) => (
                        <div key={c.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs">{c.author}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-300">
                                {c.role}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500">{c.createdAt}</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-normal">{c.text}</p>
                          <div className="flex items-center gap-3 pt-1">
                            <button
                              type="button"
                              onClick={() => handleToggleLike(c.id)}
                              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              👍 {c.likes}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ========================================================== */}
        {/* DRAGGABLE VERTICAL DIVIDER (Desktop Only) */}
        {/* ========================================================== */}
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={handleMouseDown}
          className={cn(
            "hidden lg:flex items-center justify-center w-3 cursor-col-resize select-none relative group z-20 shrink-0",
            isDragging && "cursor-col-resize"
          )}
          title="Drag to resize main area and sidebar"
        >
          <div
            className={cn(
              "w-0.5 h-full rounded-full transition-colors duration-150",
              isDragging ? "bg-[#7DC8F7]" : "bg-slate-100 group-hover:bg-[#7DC8F7]"
            )}
          />
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 w-4 h-8 rounded-md bg-slate-50 border shadow-xs flex items-center justify-center transition-all duration-150",
              isDragging
                ? "border-[#7DC8F7] scale-105"
                : "border-slate-200 group-hover:border-[#7DC8F7]"
            )}
          >
            <GripVertical
              className={cn("w-3 h-3", isDragging ? "text-[#7DC8F7]" : "text-slate-500 group-hover:text-brand-600")}
            />
          </div>
        </div>

        {/* ========================================================== */}
        {/* RIGHT COLUMN: Curriculum Sidebar & Notes (Persistent) */}
        {/* ========================================================== */}
        <aside
          style={{ width: undefined }}
          className={cn(
            "rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden flex flex-col",
            "lg:min-w-[300px] lg:flex-1",
            !isMobileSidebarOpen && "hidden lg:flex",
            isMobileSidebarOpen && "flex mt-4 lg:mt-0"
          )}
          ref={(node) => {
            if (node && window.innerWidth >= 1024) {
              node.style.width = `${100 - leftWidthPct}%`;
            } else if (node) {
              node.style.width = "100%";
            }
          }}
        >
          {/* Top Tabs in Sidebar: Course Content | Notes */}
          <div className="flex border-b border-slate-200 bg-slate-50 px-4">
            <button
              type="button"
              onClick={() => setActiveSidebarTab("content")}
              className={cn(
                "py-3 px-4 text-xs font-bold transition-all border-b-2 -mb-px cursor-pointer",
                activeSidebarTab === "content"
                  ? "text-slate-900 border-[#7DC8F7]"
                  : "text-slate-500 border-transparent hover:text-slate-800"
              )}
            >
              Course Content
            </button>
            <button
              type="button"
              onClick={() => setActiveSidebarTab("notes")}
              className={cn(
                "py-3 px-4 text-xs font-bold transition-all border-b-2 -mb-px cursor-pointer flex items-center gap-1.5",
                activeSidebarTab === "notes"
                  ? "text-slate-900 border-[#7DC8F7]"
                  : "text-slate-500 border-transparent hover:text-slate-800"
              )}
            >
              <Edit3 size={13} />
              <span>Notes</span>
              {notesList.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#7DC8F7]/25 text-[#A8DDF8]">
                  {notesList.length}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: COURSE CONTENT (MODULES ACCORDIONS & ASSESSMENTS) */}
          {activeSidebarTab === "content" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Overall Course Progress Box */}
              <div className="flex items-center gap-3.5 p-4 border-b border-slate-200 bg-white">
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                  <b className="text-sm font-bold text-[#10B981]">{progressPercent}%</b>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-slate-900">Course Progress</span>
                    <span className="text-slate-400 text-[11px]">
                      {modulesList.length} modules · {modulesList.reduce((acc, m) => acc + m.topics.length, 0)} lessons
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#10B981] rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Modules Accordion List */}
              <div className="divide-y divide-slate-200 text-xs overflow-y-auto flex-1 max-h-[640px]">
                {modulesList.map((m, mIdx) => {
                  const isExpanded = expandedModules[m.module_id] ?? true;
                  const modulePct = getModuleProgress(m);
                  const isModuleDone = modulePct === 100 || (m as any).completed || (m as any).test_passed;

                  return (
                    <div key={m.module_id} className={cn("p-3.5 space-y-2", !m.unlocked && "opacity-60")}>
                      {/* Module Header Bar (with + / - Toggle) */}
                      <div
                        onClick={() =>
                          setExpandedModules((prev) => ({
                            ...prev,
                            [m.module_id]: !isExpanded,
                          }))
                        }
                        className="flex items-center justify-between cursor-pointer select-none group"
                      >
                        <div className="flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            {isModuleDone ? (
                              <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-[#10B981] tracking-wider">
                                <Check size={12} className="stroke-[3]" /> MODULE {m.position || mIdx + 1}
                              </span>
                            ) : (
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                MODULE {m.position || mIdx + 1}
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-slate-800 group-hover:text-slate-900 transition-colors mt-0.5">
                            {m.title}
                          </h4>
                        </div>

                        {/* + / - toggle icon matching reference exactly */}
                        <div className="flex items-center gap-2 text-slate-400 group-hover:text-slate-700">
                          {isExpanded ? <Minus size={15} /> : <Plus size={15} />}
                        </div>
                      </div>

                      {/* Module Lessons List (Expanded) */}
                      {isExpanded && (
                        <div className="space-y-1.5 pt-1">
                          {m.topics.map((t) => {
                            const isSelected = leftContentView.type === "lesson" && activeTopic?.topic_id === t.topic_id;
                            const chapterPct = getChapterProgress(t);
                            const isTopicDone = chapterPct === 100 || Boolean((t as any).test_passed || t.completed);

                            return (
                              <button
                                key={t.topic_id}
                                type="button"
                                onClick={() => {
                                  setSelectedTopicId(t.topic_id);
                                  setLeftContentView({ type: "lesson" });
                                  setIsMobileSidebarOpen(false);
                                }}
                                className={cn(
                                  "w-full text-left p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-2.5",
                                  isSelected
                                    ? "bg-brand-50 border border-[#7DC8F7]/50 text-slate-900 shadow-sm"
                                    : "bg-white hover:bg-slate-50 border border-transparent text-slate-600"
                                )}
                              >
                                <div className="min-w-0 flex-1">
                                  <span className={cn("block truncate text-xs font-medium", isSelected && "font-bold text-slate-900")}>
                                    {t.title}
                                  </span>
                                  <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                    <Clock size={11} /> 02:53 mins
                                  </span>
                                </div>

                                {/* Status Icon on Right: Green checkmark when done */}
                                <div className="shrink-0 flex items-center">
                                  {isTopicDone ? (
                                    <span className="w-5 h-5 rounded-full bg-[#10B981] text-slate-900 flex items-center justify-center shadow-xs">
                                      <Check size={12} className="stroke-[3]" />
                                    </span>
                                  ) : isSelected ? (
                                    <span className="w-2 h-2 rounded-full bg-[#7DC8F7] animate-ping" />
                                  ) : (
                                    <span className="w-4 h-4 rounded-full border border-slate-300" />
                                  )}
                                </div>
                              </button>
                            );
                          })}

                          {/* Module Assessment Row (if configured) */}
                          <button
                            type="button"
                            onClick={() => {
                              const testId = (m as any)?.module_test_id;
                              if (!testId) {
                                notify.info("No module test configured yet.");
                                return;
                              }
                              setLeftContentView({
                                type: "module_test",
                                testId,
                                moduleTitle: m.title,
                                moduleId: m.module_id,
                              });
                            }}
                            className={cn(
                              "w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2",
                              leftContentView.type === "module_test" && leftContentView.moduleId === m.module_id
                                ? "bg-[#7DC8F7]/20 border-[#7DC8F7] text-slate-900"
                                : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Award size={14} className="text-[#7DC8F7] shrink-0" />
                              <span className="text-xs font-bold truncate">Module Assessment</span>
                            </div>
                            <span className="text-[10px] text-slate-400">70% Pass</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Final Certification Exam Card */}
                {finalTestId && (
                  <div className="p-3.5 bg-white">
                    <div
                      onClick={handleFinalTestClick}
                      className={cn(
                        "p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3",
                        leftContentView.type === "final_exam"
                          ? "bg-[#7DC8F7]/25 border-[#7DC8F7] text-slate-900"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#7DC8F7]/20 text-[#A8DDF8] flex items-center justify-center shrink-0">
                          <Award size={16} />
                        </div>
                        <div className="min-w-0">
                          <b className="text-xs font-bold text-slate-900 block truncate">
                            Final Certification Exam
                          </b>
                          <span className="text-[10px] text-slate-400">
                            {finalStatus === "completed"
                              ? "Exam Passed ✓"
                              : finalStatus === "available"
                              ? "Ready to Start"
                              : "Prerequisites Required"}
                          </span>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                          finalStatus === "completed"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : finalStatus === "available"
                            ? "bg-[#7DC8F7]/20 text-[#A8DDF8] border border-[#7DC8F7]/40"
                            : "bg-slate-800 text-slate-500"
                        )}
                      >
                        {finalStatus === "completed" ? "Passed" : finalStatus === "available" ? "Available" : "Locked"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Official Certificate Card (when course completed) */}
                {isCourseCompleted && (
                  <div className="p-3.5 bg-white">
                    <div
                      onClick={() => setLeftContentView({ type: "certificate" })}
                      className={cn(
                        "p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3",
                        leftContentView.type === "certificate"
                          ? "bg-emerald-50 border-emerald-400 text-emerald-900"
                          : "bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200 text-emerald-800"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                          <CheckCircle2 size={16} />
                        </div>
                        <div className="min-w-0">
                          <b className="text-xs font-bold text-emerald-900 block truncate">
                            Course Certificate
                          </b>
                          <span className="text-[10px] text-emerald-400">Awarded &amp; Verified</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        View
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: NOTES NOTEBOOK */}
          {activeSidebarTab === "notes" && (
            <div className="flex flex-col flex-1 p-4 space-y-3 overflow-hidden bg-white">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900">Lesson Notes</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Take notes synchronized with the video. Click any timestamp to jump to that moment in the lecture.
                </p>
              </div>

              {/* Note Input Box */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder={`Write your note for "${activeTopic?.title || "this lesson"}"...`}
                  rows={3}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-[#7DC8F7] resize-none"
                />

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setNoteIncludeTimestamp((prev) => !prev)}
                    className={cn(
                      "text-[11px] px-2.5 py-1 rounded-md font-semibold cursor-pointer border transition-colors flex items-center gap-1",
                      noteIncludeTimestamp
                        ? "bg-[#7DC8F7]/20 text-[#A8DDF8] border-[#7DC8F7]/40"
                        : "bg-slate-100 text-slate-500 border-transparent hover:text-slate-800"
                    )}
                  >
                    <span>⏱ Tag at {formatTime(currentTime)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveNote}
                    className="px-3.5 py-1.5 rounded-lg bg-[#7DC8F7] hover:bg-[#5CB8EC] text-white font-bold text-xs transition-colors cursor-pointer shadow-sm"
                  >
                    Save Note
                  </button>
                </div>
              </div>

              {/* Saved Notes List */}
              <div className="space-y-2 overflow-y-auto flex-1 max-h-[460px] pr-1">
                {notesList.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    No notes for this lesson yet. Type a note above to record insights!
                  </div>
                ) : (
                  notesList.map((note) => (
                    <div
                      key={note.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 group"
                    >
                      <div className="flex items-center justify-between">
                        {note.timestamp > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleSeekToTimestamp(note.timestamp)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#7DC8F7]/20 hover:bg-[#7DC8F7]/35 text-[#A8DDF8] text-[10px] font-mono font-bold cursor-pointer transition-colors border border-[#7DC8F7]/40"
                            title="Click to seek video"
                          >
                            <Play size={10} className="fill-current" />
                            <span>{note.timestampFormatted}</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500">General Note</span>
                        )}

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">{note.createdAt}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                            title="Delete note"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{note.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ============================================================ */}
      {/* 3. IN-APP PDF VIEWER MODAL */}
      {/* ============================================================ */}
      {isPdfViewerOpen && (
        <InAppPdfViewer
          isOpen={isPdfViewerOpen}
          onClose={() => setIsPdfViewerOpen(false)}
          documentTitle={currentPdfItem?.title || `${activeTopic?.title || "Lesson"} - Reference Slides.pdf`}
          mediaId={(currentPdfItem as any)?.media_id}
          chapterTitle={activeTopic?.title}
          courseTitle={courseTitle}
          moduleTitle={currentActiveModule?.title}
        />
      )}
    </div>
  );
}
export default StudentLearningPage;
