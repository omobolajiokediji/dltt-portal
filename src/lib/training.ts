import { Firestore, collection, doc, writeBatch } from 'firebase/firestore';
import { STATES, WEEKS } from '../constants';
import { AssignmentSubmission, LearningMaterial, TrainingStats, UserProfile } from '../types';

type UserLike = Pick<UserProfile, 'uid' | 'state'>;

export interface TeacherProgress {
  totalAssignments: number;
  submittedAssignments: number;
  completionRate: number;
  totalScore: number;
  attendanceCount: number;
  attendanceRate: number;
  assignmentCompletion: Record<string, boolean>;
}

function getTimestamp(value: string | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function isMaterialAssignedToUser(material: LearningMaterial, user: UserLike) {
  const assignedToAll = material.assignedTo?.includes('all') ?? true;
  const assignedStateAll = material.assignedStates?.includes('all') ?? true;

  return (
    assignedToAll ||
    material.assignedTo?.includes(user.uid) ||
    assignedStateAll ||
    material.assignedStates?.includes(user.state)
  );
}

function getLatestSubmissionMap(teacherId: string, submissions: AssignmentSubmission[]) {
  const latestByMaterial = new Map<string, AssignmentSubmission>();

  for (const submission of submissions) {
    if (submission.teacherId !== teacherId) {
      continue;
    }

    const existing = latestByMaterial.get(submission.materialId);
    if (!existing || getTimestamp(submission.submittedAt) >= getTimestamp(existing.submittedAt)) {
      latestByMaterial.set(submission.materialId, submission);
    }
  }

  return latestByMaterial;
}

export function getTeacherProgress(
  teacher: UserProfile,
  materials: LearningMaterial[],
  submissions: AssignmentSubmission[],
): TeacherProgress {
  const assignedAssignments = materials.filter(
    (material) => material.type === 'assignment' && isMaterialAssignedToUser(material, teacher),
  );
  const latestSubmissions = getLatestSubmissionMap(teacher.uid, submissions);
  const assignmentCompletion: Record<string, boolean> = {};

  let totalScore = 0;
  for (const material of assignedAssignments) {
    const submission = latestSubmissions.get(material.id);
    if (!submission) {
      continue;
    }

    assignmentCompletion[material.id] = true;
    if (typeof submission.score === 'number') {
      totalScore += submission.score;
    }
  }

  const attendanceCount = WEEKS.filter((week) => teacher.attendance?.[`week${week}`]).length;
  const totalAssignments = assignedAssignments.length;
  const submittedAssignments = Object.keys(assignmentCompletion).length;
  const completionRate = totalAssignments > 0 ? Math.round((submittedAssignments / totalAssignments) * 100) : 0;
  const attendanceRate = WEEKS.length > 0 ? Math.round((attendanceCount / WEEKS.length) * 100) : 0;

  return {
    totalAssignments,
    submittedAssignments,
    completionRate,
    totalScore,
    attendanceCount,
    attendanceRate,
    assignmentCompletion,
  };
}

export function buildTrainingStats(
  users: UserProfile[],
  materials: LearningMaterial[],
  submissions: AssignmentSubmission[],
): TrainingStats {
  const teachers = users.filter((user) => user.role === 'teacher');
  const teacherProgress = teachers.map((teacher) => {
    const progress = getTeacherProgress(teacher, materials, submissions);
    return {
      teacher,
      progress,
    };
  });

  const enrollment = teachers.length;
  const completionRate =
    teacherProgress.length > 0
      ? Math.round(
          teacherProgress.reduce((sum, entry) => sum + entry.progress.completionRate, 0) / teacherProgress.length,
        )
      : 0;

  const teacherLeaderboard = teacherProgress
    .map(({ teacher, progress }) => ({
      name: teacher.name,
      score: progress.totalScore,
      state: teacher.state,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 20);

  const stateLeaderboard = STATES.map((state) => {
    const stateTeachers = teacherProgress.filter((entry) => entry.teacher.state === state);
    if (stateTeachers.length === 0) {
      return { state, score: 0 };
    }

    const score = Math.round(
      stateTeachers.reduce((sum, entry) => sum + entry.progress.completionRate, 0) / stateTeachers.length,
    );

    return { state, score };
  }).sort((a, b) => b.score - a.score || a.state.localeCompare(b.state));

  return {
    enrollment,
    completionRate,
    teacherLeaderboard,
    stateLeaderboard,
  };
}

function assignmentCompletionChanged(
  current: Record<string, boolean> | undefined,
  next: Record<string, boolean>,
) {
  const currentKeys = Object.keys(current ?? {}).sort();
  const nextKeys = Object.keys(next).sort();

  if (currentKeys.length !== nextKeys.length) {
    return true;
  }

  return currentKeys.some((key, index) => key !== nextKeys[index] || current?.[key] !== next[key]);
}

export async function syncTrainingDerivedData(
  db: Firestore,
  users: UserProfile[],
  materials: LearningMaterial[],
  submissions: AssignmentSubmission[],
) {
  const teachers = users.filter((user) => user.role === 'teacher');
  const batch = writeBatch(db);

  for (const teacher of teachers) {
    const progress = getTeacherProgress(teacher, materials, submissions);
    const totalScoreChanged = teacher.totalScore !== progress.totalScore;
    const completionChanged = assignmentCompletionChanged(teacher.assignmentCompletion, progress.assignmentCompletion);

    if (totalScoreChanged || completionChanged) {
      batch.update(doc(db, 'users', teacher.uid), {
        totalScore: progress.totalScore,
        assignmentCompletion: progress.assignmentCompletion,
      });
    }
  }

  batch.set(doc(db, 'stats', 'global'), buildTrainingStats(users, materials, submissions));
  await batch.commit();
}
