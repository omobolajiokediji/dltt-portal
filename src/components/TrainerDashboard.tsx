import React, { useEffect, useMemo, useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import {
  AudioWaveform,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  ClipboardCheck,
  Crown,
  FileText,
  GraduationCap,
  Link as LinkIcon,
  Plus,
  Target,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';
import { db, secondaryAuth } from '../lib/firebase';
import { STATES, WEEKS } from '../constants';
import { AssignmentSubmission, GrowthRole, LearningMaterial, UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import {
  certificateLevelLabels,
  downloadCertificatePdf,
  getCertificateLevelsForUser,
  isCertificationApproved,
} from '../lib/certificates';
import { sortMaterialsByNewest } from '../lib/materials';
import { getTeacherProgress, isMaterialAssignedToUser } from '../lib/training';
import Notification, { NotificationType } from './Notification';

type TrainerTab = 'materials' | 'teachers' | 'assignments' | 'grading' | 'certificates';

const trainerLevelConfig = {
  trainer: {
    title: 'Trainer',
    capacity: 20,
    nextTitle: 'Master Trainer',
    accent: 'from-emerald-500 to-lime-400',
  },
  'master-trainer': {
    title: 'Master Trainer',
    capacity: 50,
    nextTitle: 'Pro Trainer',
    accent: 'from-amber-500 to-yellow-300',
  },
  'pro-trainer': {
    title: 'Pro Trainer',
    capacity: 100,
    nextTitle: 'Pro Trainer Elite',
    accent: 'from-rose-500 to-orange-300',
  },
} as const;

function getTrainerLevelConfig(role: UserProfile['role']) {
  return role in trainerLevelConfig
    ? trainerLevelConfig[role as keyof typeof trainerLevelConfig]
    : trainerLevelConfig.trainer;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

const defaultTeacherForm = {
  name: '',
  email: '',
  phone: '',
  state: 'Lagos State',
  school: '',
  gender: '',
};

const defaultAssignmentForm = {
  title: '',
  description: '',
  contentUrl: '',
  dueDate: '',
  week: 1,
  assignedTo: [] as string[],
};

export default function TrainerDashboard({ user }: { user: UserProfile }) {
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [activeTab, setActiveTab] = useState<TrainerTab>('teachers');
  const [teacherForm, setTeacherForm] = useState(defaultTeacherForm);
  const [assignmentForm, setAssignmentForm] = useState(defaultAssignmentForm);
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, { score: string; feedback: string }>>({});
  const [loading, setLoading] = useState(true);
  const [isCreatingTeacher, setIsCreatingTeacher] = useState(false);
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));
  const levelConfig = getTrainerLevelConfig(user.role);
  const enrolledTeacherCount = teachers.length;
  const remainingTeacherSlots = Math.max(0, levelConfig.capacity - enrolledTeacherCount);
  const capacityProgress = Math.min(100, Math.round((enrolledTeacherCount / levelConfig.capacity) * 100));
  const isAtTeacherCapacity = enrolledTeacherCount >= levelConfig.capacity;
  const nextMilestoneRemaining = Math.max(0, levelConfig.capacity - enrolledTeacherCount);

  const toggleWeekExpanded = (week: number) => {
    setExpandedWeeks((current) => {
      const next = new Set(current);
      if (next.has(week)) {
        next.delete(week);
      } else {
        next.add(week);
      }
      return next;
    });
  };

  useEffect(() => {
    const teachersQuery = query(collection(db, 'users'), where('role', '==', 'teacher'), where('trainerId', '==', user.uid));
    const unsubscribeTeachers = onSnapshot(
      teachersQuery,
      (snapshot) => {
        setTeachers(snapshot.docs.map((item) => ({ uid: item.id, ...item.data() })) as UserProfile[]);
        setLoading(false);
      },
      (error) => {
        console.error('Failed to load trainer teachers:', error);
        setNotification({
          message: 'Could not load your trainer dashboard. Please ask Admin to deploy the latest Firestore rules.',
          type: 'error',
        });
        setLoading(false);
      },
    );

    const unsubscribeMaterials = onSnapshot(
      collection(db, 'materials'),
      (snapshot) => {
        setMaterials(
          sortMaterialsByNewest(
            snapshot.docs.map((item) => ({ ...(item.data() as LearningMaterial), firestoreId: item.id })),
          ),
        );
      },
      (error) => {
        console.error('Failed to load trainer materials:', error);
        setNotification({
          message: 'Could not load trainer materials. Please refresh and try again.',
          type: 'error',
        });
      },
    );

    return () => {
      unsubscribeTeachers();
      unsubscribeMaterials();
    };
  }, [user.uid]);

  const teacherIds = useMemo(() => teachers.map((teacher) => teacher.uid), [teachers]);
  const teacherIdsKey = teacherIds.join('|');

  useEffect(() => {
    if (teacherIds.length === 0) {
      setSubmissions([]);
      return undefined;
    }

    const teacherIdChunks = chunkArray(teacherIds, 30);
    const submissionsByChunk = new Map<number, AssignmentSubmission[]>();

    const unsubscribeSubmissions = teacherIdChunks.map((teacherIdChunk, index) => {
      const submissionsQuery = query(collection(db, 'submissions'), where('teacherId', 'in', teacherIdChunk));

      return onSnapshot(
        submissionsQuery,
        (snapshot) => {
          submissionsByChunk.set(
            index,
            snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as AssignmentSubmission),
          );

          setSubmissions(
            Array.from(submissionsByChunk.values())
              .flat()
              .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt)),
          );
        },
        (error) => {
          console.error('Failed to load trainer submissions:', error);
          setNotification({
            message: 'Could not load submissions for your teachers. Please refresh and try again.',
            type: 'error',
          });
        },
      );
    });

    return () => unsubscribeSubmissions.forEach((unsubscribe) => unsubscribe());
  }, [teacherIdsKey]);

  const trainerMaterials = useMemo(() => {
    const teacherIdSet = new Set(teacherIds);
    return materials.filter(
      (material) =>
        material.createdBy === user.uid ||
        material.assignedTo?.some((teacherId) => teacherIdSet.has(teacherId)),
    );
  }, [materials, teacherIds, user.uid]);

  const learningMaterials = useMemo(
    () => materials.filter((material) => isMaterialAssignedToUser(material, user)),
    [materials, user],
  );

  const assignmentMaterials = useMemo(
    () => trainerMaterials.filter((material) => material.type === 'assignment'),
    [trainerMaterials],
  );

  const pendingSubmissions = submissions.filter((submission) => submission.status === 'pending');
  const gradedSubmissions = submissions.filter((submission) => submission.status === 'graded');
  const certificateLevels = useMemo(() => getCertificateLevelsForUser(user), [user]);
  const teacherById = useMemo(
    () => new Map(teachers.map((teacher) => [teacher.uid, teacher])),
    [teachers],
  );
  const materialById = useMemo(
    () => new Map(assignmentMaterials.map((material) => [material.id, material])),
    [assignmentMaterials],
  );

  const handleCreateTeacher = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!teacherForm.email || !teacherForm.phone || !teacherForm.name) {
      setNotification({ message: 'Name, email, and phone are required.', type: 'error' });
      return;
    }

    if (isAtTeacherCapacity) {
      setNotification({
        message: `${levelConfig.title}s can train up to ${levelConfig.capacity} teachers. Ask Admin for promotion to unlock more capacity.`,
        type: 'error',
      });
      return;
    }

    try {
      setIsCreatingTeacher(true);
      const email = teacherForm.email.trim().toLowerCase();
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, teacherForm.phone.trim());
      const uid = userCredential.user.uid;

      await setDoc(doc(db, 'users', uid), {
        uid,
        name: teacherForm.name.trim(),
        email,
        phone: teacherForm.phone.trim(),
        role: 'teacher',
        state: teacherForm.state,
        trainerId: user.uid,
        createdBy: user.uid,
        school: teacherForm.school.trim(),
        gender: teacherForm.gender || null,
        approvedForCertificate: false,
        totalScore: 0,
        attendance: {},
        assignmentCompletion: {},
      });

      setTeacherForm(defaultTeacherForm);
      setNotification({ message: 'Teacher enrolled successfully. Phone number is the initial password.', type: 'success' });
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        setNotification({ message: 'This email is already registered.', type: 'error' });
      } else {
        handleFirestoreError(error, OperationType.CREATE, 'teacher');
      }
    } finally {
      setIsCreatingTeacher(false);
    }
  };

  const handleCreateAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!assignmentForm.title || !assignmentForm.contentUrl || assignmentForm.assignedTo.length === 0) {
      setNotification({ message: 'Title, URL, and at least one teacher are required.', type: 'error' });
      return;
    }

    try {
      setIsCreatingAssignment(true);
      const materialRef = doc(collection(db, 'materials'));
      await setDoc(materialRef, {
        id: materialRef.id,
        title: assignmentForm.title.trim(),
        description: assignmentForm.description.trim(),
        type: 'assignment',
        contentUrl: assignmentForm.contentUrl.trim(),
        assignedTo: assignmentForm.assignedTo,
        assignedStates: [],
        dueDate: assignmentForm.dueDate,
        week: assignmentForm.week,
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
      });

      setAssignmentForm(defaultAssignmentForm);
      setNotification({ message: 'Assignment created and assigned.', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'assignment');
    } finally {
      setIsCreatingAssignment(false);
    }
  };

  const handleAttendanceChange = async (teacher: UserProfile, week: number, checked: boolean) => {
    try {
      await updateDoc(doc(db, 'users', teacher.uid), {
        attendance: {
          ...(teacher.attendance || {}),
          [`week${week}`]: checked,
        },
      });
      setNotification({ message: 'Attendance updated.', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'attendance');
    }
  };

  const handleGradeSubmission = async (submission: AssignmentSubmission) => {
    const draft = gradeDrafts[submission.id];
    const score = Number(draft?.score);

    if (!draft || Number.isNaN(score) || score < 0 || score > 100) {
      setNotification({ message: 'Enter a score between 0 and 100.', type: 'error' });
      return;
    }

    try {
      await updateDoc(doc(db, 'submissions', submission.id), {
        score,
        feedback: draft.feedback || '',
        status: 'graded',
      });
      setGradeDrafts((current) => {
        const next = { ...current };
        delete next[submission.id];
        return next;
      });
      setNotification({ message: 'Submission graded.', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'submission grade');
    }
  };

  const toggleAssignmentTeacher = (teacherId: string) => {
    setAssignmentForm((current) => ({
      ...current,
      assignedTo: current.assignedTo.includes(teacherId)
        ? current.assignedTo.filter((id) => id !== teacherId)
        : [...current.assignedTo, teacherId],
    }));
  };

  const handleCertificateDownload = async (level: GrowthRole) => {
    try {
      await downloadCertificatePdf(user, level);
    } catch (error) {
      setNotification({ message: 'Could not generate the certificate PDF. Please try again.', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dltt-green"></div>
      </div>
    );
  }

  const stats = [
    { label: 'My Teachers', value: enrolledTeacherCount, icon: Users },
    { label: 'Capacity', value: `${enrolledTeacherCount}/${levelConfig.capacity}`, icon: Target },
    { label: 'Assignments', value: assignmentMaterials.length, icon: ClipboardCheck },
    { label: 'Pending Grades', value: pendingSubmissions.length, icon: GraduationCap },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-dltt-green">Trainer Workspace</p>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">Welcome, {user.name}</h1>
        <p className="text-gray-600 mt-1">
          {levelConfig.title} dashboard for enrolling teachers, assigning work, and managing activity for your cohort.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-8 overflow-hidden relative">
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${levelConfig.accent}`} />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-green-50 text-dltt-green flex items-center justify-center shrink-0">
              <Crown size={27} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Growth Level</p>
              <h2 className="text-2xl font-bold text-gray-900 mt-1">{levelConfig.title}</h2>
              <p className="text-sm text-gray-600 mt-1">
                {isAtTeacherCapacity
                  ? `You have reached the ${levelConfig.capacity}-teacher capacity for this level.`
                  : `${nextMilestoneRemaining} more teacher${nextMilestoneRemaining === 1 ? '' : 's'} to fill this level capacity.`}
              </p>
            </div>
          </div>

          <div className="w-full lg:max-w-xl">
            <div className="flex items-center justify-between gap-4 text-sm font-bold text-gray-700 mb-2">
              <span>{enrolledTeacherCount} enrolled</span>
              <span>{levelConfig.capacity} capacity</span>
            </div>
            <div className="h-4 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${levelConfig.accent} transition-all duration-500`}
                style={{ width: `${Math.max(enrolledTeacherCount > 0 ? 8 : 0, capacityProgress)}%` }}
              />
            </div>
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
              <span className="font-semibold text-dltt-green">{capacityProgress}% of level capacity reached</span>
              <span className="text-gray-500">
                {user.role === 'pro-trainer'
                  ? 'Top level: keep building a strong training record.'
                  : `Next path: ${levelConfig.nextTitle} by Admin/SuperAdmin promotion.`}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((item) => (
          <div key={item.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{item.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{item.value}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-green-50 text-dltt-green flex items-center justify-center">
                <item.icon size={23} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex space-x-4 mb-8 border-b border-gray-200 overflow-x-auto">
        {[
          { id: 'materials', label: 'Learning Materials', icon: BookOpen },
          { id: 'teachers', label: 'Teachers', icon: Users },
          { id: 'assignments', label: 'Assignments', icon: ClipboardCheck },
          { id: 'grading', label: 'Grading', icon: CheckCircle2 },
          { id: 'certificates', label: 'Certificates', icon: Award },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as TrainerTab)}
            className={`flex items-center space-x-2 px-4 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-dltt-green text-dltt-green'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'materials' && (
        <div className="space-y-6">
          {WEEKS.map((week) => {
            const weekMaterials = learningMaterials.filter((material) => material.week === week);

            return (
              <div key={week} className="space-y-3">
                <button
                  type="button"
                  onClick={() => toggleWeekExpanded(week)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all"
                >
                  <h2 className="text-lg font-bold text-gray-800 flex items-center space-x-3">
                    <span className="bg-dltt-green text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold">
                      W{week}
                    </span>
                    <span>Week {week} Materials</span>
                  </h2>
                  <ChevronDown
                    size={20}
                    className={`text-gray-600 transition-transform ${expandedWeeks.has(week) ? 'rotate-180' : ''}`}
                  />
                </button>

                {expandedWeeks.has(week) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {weekMaterials.map((material) => (
                      <div
                        key={material.firestoreId || material.id}
                        className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start mb-4 gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              material.type === 'assignment' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                            }`}
                          >
                            {material.type === 'assignment' ? (
                              <FileText size={20} />
                            ) : material.type === 'video' ? (
                              <Video size={20} />
                            ) : material.type === 'audio' ? (
                              <AudioWaveform size={20} />
                            ) : (
                              <BookOpen size={20} />
                            )}
                          </div>
                          {material.type === 'assignment' && material.dueDate && (
                            <span className="text-xs font-medium px-2 py-1 bg-yellow-50 text-yellow-700 rounded-full">
                              Due: {new Date(material.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        <h3 className="font-bold text-gray-900 mb-2">{material.title}</h3>
                        <p className="text-sm text-gray-600 mb-4 line-clamp-3">{material.description}</p>

                        <a
                          href={material.contentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-center bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                        >
                          View {material.type === 'assignment' ? 'Task' : 'Material'}
                        </a>
                      </div>
                    ))}
                    {weekMaterials.length === 0 && (
                      <p className="text-gray-500 italic text-sm py-4">No materials uploaded for this week yet.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'teachers' && (
        <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-8 items-start">
          <form onSubmit={handleCreateTeacher} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <UserPlus size={20} />
                Enrol Teacher
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                The teacher will be attached to your {levelConfig.title.toLowerCase()} account.
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-gray-700">Teacher capacity</span>
                <span className="font-bold text-dltt-green">{enrolledTeacherCount}/{levelConfig.capacity}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${levelConfig.accent}`}
                  style={{ width: `${Math.max(enrolledTeacherCount > 0 ? 8 : 0, capacityProgress)}%` }}
                />
              </div>
              {isAtTeacherCapacity && (
                <p className="text-sm font-medium text-amber-700 mt-3">
                  Capacity reached. Admin or SuperAdmin can promote you to unlock more teacher slots.
                </p>
              )}
            </div>

            <fieldset disabled={isAtTeacherCapacity} className="space-y-4 disabled:opacity-60">
              <input required className="input-field" placeholder="Full name" value={teacherForm.name} onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })} />
              <input required type="email" className="input-field" placeholder="Email address" value={teacherForm.email} onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })} />
              <input required type="tel" className="input-field" placeholder="Phone number / initial password" value={teacherForm.phone} onChange={(e) => setTeacherForm({ ...teacherForm, phone: e.target.value })} />
              <select className="input-field" value={teacherForm.state} onChange={(e) => setTeacherForm({ ...teacherForm, state: e.target.value })}>
                {STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              <input className="input-field" placeholder="School / Institution" value={teacherForm.school} onChange={(e) => setTeacherForm({ ...teacherForm, school: e.target.value })} />
              <select className="input-field" value={teacherForm.gender} onChange={(e) => setTeacherForm({ ...teacherForm, gender: e.target.value })}>
                <option value="">Gender not specified</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <button type="submit" disabled={isCreatingTeacher || isAtTeacherCapacity} className="btn-primary w-full justify-center">
                <Plus size={18} />
                {isCreatingTeacher ? 'Enrolling...' : isAtTeacherCapacity ? 'Capacity Reached' : 'Enrol Teacher'}
              </button>
            </fieldset>
          </form>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">My Teachers</h2>
              <p className="text-sm text-gray-500 mt-1">
                {remainingTeacherSlots} open slot{remainingTeacherSlots === 1 ? '' : 's'} at this level.
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {teachers.map((teacher) => {
                const progress = getTeacherProgress(teacher, trainerMaterials, submissions);
                return (
                  <div key={teacher.uid} className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div>
                        <p className="font-bold text-gray-900">{teacher.name}</p>
                        <p className="text-sm text-gray-500">{teacher.email} - {teacher.state}</p>
                        <p className="text-sm text-gray-600 mt-2">
                          {progress.totalScore} pts - {progress.completionRate}% completion - {progress.attendanceCount}/{WEEKS.length} attendance weeks
                        </p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {WEEKS.map((week) => (
                          <label key={week} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!teacher.attendance?.[`week${week}`]}
                              onChange={(e) => handleAttendanceChange(teacher, week, e.target.checked)}
                            />
                            Week {week}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              {teachers.length === 0 && <p className="p-8 text-center text-gray-500">No teachers enrolled yet.</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-8 items-start">
          <form onSubmit={handleCreateAssignment} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Assign New Task</h2>
            <input required className="input-field" placeholder="Assignment title" value={assignmentForm.title} onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })} />
            <textarea className="input-field min-h-24" placeholder="Description" value={assignmentForm.description} onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })} />
            <input required type="url" className="input-field" placeholder="https://..." value={assignmentForm.contentUrl} onChange={(e) => setAssignmentForm({ ...assignmentForm, contentUrl: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <select className="input-field" value={assignmentForm.week} onChange={(e) => setAssignmentForm({ ...assignmentForm, week: Number(e.target.value) })}>
                {WEEKS.map((week) => (
                  <option key={week} value={week}>
                    Week {week}
                  </option>
                ))}
              </select>
              <input required type="date" className="input-field" value={assignmentForm.dueDate} onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })} />
            </div>
            <div className="rounded-xl border border-gray-200 p-3 max-h-56 overflow-y-auto space-y-2">
              {teachers.map((teacher) => (
                <label key={teacher.uid} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={assignmentForm.assignedTo.includes(teacher.uid)}
                    onChange={() => toggleAssignmentTeacher(teacher.uid)}
                  />
                  {teacher.name}
                </label>
              ))}
              {teachers.length === 0 && <p className="text-sm text-gray-500">Enrol teachers before assigning tasks.</p>}
            </div>
            <button type="submit" disabled={isCreatingAssignment || teachers.length === 0} className="btn-primary w-full justify-center">
              <Plus size={18} />
              {isCreatingAssignment ? 'Creating...' : 'Create Assignment'}
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assignmentMaterials.map((material) => (
              <div key={material.firestoreId || material.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="h-10 w-10 rounded-xl bg-green-50 text-dltt-green flex items-center justify-center">
                    {material.type === 'video' ? <Video size={20} /> : material.type === 'audio' ? <AudioWaveform size={20} /> : material.type === 'assignment' ? <FileText size={20} /> : <BookOpen size={20} />}
                  </div>
                  <span className="text-xs font-bold text-gray-500">Week {material.week}</span>
                </div>
                <h3 className="font-bold text-gray-900 mt-4">{material.title}</h3>
                <p className="text-sm text-gray-600 mt-2 line-clamp-3">{material.description}</p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-500">{material.assignedTo?.length || 0} teacher(s)</span>
                  <a href={material.contentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-dltt-green">
                    <LinkIcon size={14} />
                    Open
                  </a>
                </div>
              </div>
            ))}
            {assignmentMaterials.length === 0 && <p className="text-gray-500">No assignments created yet.</p>}
          </div>
        </div>
      )}

      {activeTab === 'certificates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {certificateLevels.map((level) => {
            const approved = isCertificationApproved(user, level);

            return (
              <div key={level} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${approved ? 'bg-green-50 text-dltt-green' : 'bg-gray-100 text-gray-400'}`}>
                    {approved ? <Award size={24} /> : <Clock size={24} />}
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      approved ? 'bg-green-100 text-green-700' : 'bg-yellow-50 text-yellow-700'
                    }`}
                  >
                    {approved ? 'Approved' : 'Pending'}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-gray-900 mt-5">{certificateLevelLabels[level]} Certificate</h2>
                <p className="text-sm text-gray-600 mt-2">
                  {approved
                    ? 'This certificate has been approved by SuperAdmin and is ready to download.'
                    : 'This certificate becomes available after SuperAdmin approval.'}
                </p>
                <button
                  type="button"
                  disabled={!approved}
                  onClick={() => handleCertificateDownload(level)}
                  className={`mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                    approved
                      ? 'bg-dltt-green text-white hover:opacity-90'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Download Certificate
                </button>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'grading' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Pending Submissions</h2>
            <div className="space-y-4">
              {pendingSubmissions.map((submission) => {
                const teacher = teacherById.get(submission.teacherId);
                const material = materialById.get(submission.materialId);
                const draft = gradeDrafts[submission.id] || { score: '', feedback: '' };

                return (
                  <div key={submission.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div>
                        <p className="font-bold text-gray-900">{material?.title || 'Assignment submission'}</p>
                        <p className="text-sm text-gray-500">{teacher?.name || 'Teacher'} - {new Date(submission.submittedAt).toLocaleDateString()}</p>
                        <a href={submission.contentUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-dltt-green inline-flex items-center gap-1 mt-2">
                          <LinkIcon size={14} />
                          View submission
                        </a>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 lg:w-[520px]">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="Score"
                          className="input-field sm:w-28"
                          value={draft.score}
                          onChange={(e) => setGradeDrafts((current) => ({ ...current, [submission.id]: { ...draft, score: e.target.value } }))}
                        />
                        <input
                          type="text"
                          placeholder="Feedback"
                          className="input-field flex-1"
                          value={draft.feedback}
                          onChange={(e) => setGradeDrafts((current) => ({ ...current, [submission.id]: { ...draft, feedback: e.target.value } }))}
                        />
                        <button type="button" onClick={() => handleGradeSubmission(submission)} className="btn-primary justify-center">
                          Grade
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {pendingSubmissions.length === 0 && <p className="text-center text-gray-500 py-8">No pending submissions.</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recently Graded</h2>
            <div className="divide-y divide-gray-100">
              {gradedSubmissions.slice(0, 10).map((submission) => (
                <div key={submission.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-bold text-gray-900">{materialById.get(submission.materialId)?.title || 'Graded record'}</p>
                    <p className="text-sm text-gray-500">{teacherById.get(submission.teacherId)?.name || 'Teacher'}</p>
                  </div>
                  <p className="font-bold text-dltt-green">{submission.score ?? 0}/100</p>
                </div>
              ))}
              {gradedSubmissions.length === 0 && <p className="text-center text-gray-500 py-8">No graded submissions yet.</p>}
            </div>
          </div>
        </div>
      )}

      {notification && (
        <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />
      )}
    </div>
  );
}
