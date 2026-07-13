import { Firestore, collection, doc, writeBatch } from 'firebase/firestore';
import { STATES, WEEKS } from '../constants';
import { AssignmentSubmission, GrowthRole, LearningMaterial, TrainingStats, UserProfile } from '../types';

type UserLike = Pick<UserProfile, 'uid' | 'state'>;

const GROWTH_LEVELS: { role: GrowthRole; title: string }[] = [
  { role: 'teacher', title: 'Teachers' },
  { role: 'trainer', title: 'Trainers' },
  { role: 'senior-trainer', title: 'Senior Trainers' },
  { role: 'master-trainer', title: 'Master Trainers' },
];

export interface TeacherProgress {
  totalAssignments: number;
  submittedAssignments: number;
  totalWeeklyTests: number;
  completedWeeklyTests: number;
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

function getWeeklyTestScoreId(week: number) {
  return `test-assessment-week-${week}`;
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

  for (const week of WEEKS) {
    const submission = latestSubmissions.get(getWeeklyTestScoreId(week));
    if (typeof submission?.score === 'number') {
      totalScore += submission.score;
    }
  }

  const completedWeeklyTests = WEEKS.filter((week) => {
    const submission = latestSubmissions.get(getWeeklyTestScoreId(week));
    return typeof submission?.score === 'number';
  }).length;
  const attendanceCount = WEEKS.filter((week) => teacher.attendance?.[`week${week}`]).length;
  const totalAssignments = assignedAssignments.length;
  const submittedAssignments = Object.keys(assignmentCompletion).length;
  const totalCompletionItems = totalAssignments + WEEKS.length;
  const submittedCompletionItems = submittedAssignments + completedWeeklyTests;
  const completionRate = totalCompletionItems > 0 ? Math.round((submittedCompletionItems / totalCompletionItems) * 100) : 0;
  const attendanceRate = WEEKS.length > 0 ? Math.round((attendanceCount / WEEKS.length) * 100) : 0;

  return {
    totalAssignments,
    submittedAssignments,
    totalWeeklyTests: WEEKS.length,
    completedWeeklyTests,
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
  const activeUsers = users.filter((user) => !user.archived);
  const activeGrowthUsers = activeUsers.filter((user) =>
    ['teacher', 'trainer', 'senior-trainer', 'master-trainer'].includes(user.role),
  );
  const teachers = activeUsers.filter((user) => user.role === 'teacher');
  const trainerCount = activeUsers.filter((user) => user.role === 'trainer').length;
  const seniorTrainerCount = activeUsers.filter((user) => user.role === 'senior-trainer').length;
  const masterTrainerCount = activeUsers.filter((user) => user.role === 'master-trainer').length;
  const growthProgress = activeGrowthUsers.map((user) => {
    const progress = getTeacherProgress(user, materials, submissions);
    return {
      user,
      progress,
    };
  });
  const teacherProgress = growthProgress
    .filter((entry) => entry.user.role === 'teacher')
    .map((entry) => ({
      teacher: entry.user,
      progress: entry.progress,
    }));

  const enrollment = teachers.length;
  const activeTeachers = teachers.filter((teacher) => !!teacher.lastLoginAt).length;
  const completionRate =
    growthProgress.length > 0
      ? Math.round(
          growthProgress.reduce((sum, entry) => sum + entry.progress.completionRate, 0) / growthProgress.length,
        )
      : 0;

  const genderDistribution = [
    { label: 'Male', count: teachers.filter((teacher) => teacher.gender?.toLowerCase() === 'male').length, color: '#2e9107' },
    { label: 'Female', count: teachers.filter((teacher) => teacher.gender?.toLowerCase() === 'female').length, color: '#ebe725' },
  ];

  const teacherLeaderboard = teacherProgress
    .map(({ teacher, progress }) => ({
      name: teacher.name,
      score: progress.totalScore,
      state: teacher.state,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 20);

  const buildRoleBreakdown = (role: GrowthRole) => {
    const roleProgress = growthProgress.filter((entry) => entry.user.role === role);

    const stateDistribution = STATES.map((state) => {
      const stateEntries = roleProgress.filter((entry) => entry.user.state === state);
      const count = stateEntries.length;
      const activeCount = stateEntries.filter((entry) => !!entry.user.lastLoginAt).length;
      const avgScore = count
        ? Math.round(stateEntries.reduce((sum, entry) => sum + entry.progress.totalScore, 0) / count)
        : 0;
      const completionRateByState = count
        ? Math.round(stateEntries.reduce((sum, entry) => sum + entry.progress.completionRate, 0) / count)
        : 0;

      return {
        state,
        count,
        activeCount,
        avgScore,
        completionRate: completionRateByState,
      };
    })
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state));

    const roleUsers = roleProgress.map((entry) => entry.user);
    const genderDistribution = [
      { label: 'Male', count: roleUsers.filter((user) => user.gender?.toLowerCase() === 'male').length, color: '#2e9107' },
      { label: 'Female', count: roleUsers.filter((user) => user.gender?.toLowerCase() === 'female').length, color: '#ebe725' },
    ];

    const leaderboard = roleProgress
      .map(({ user, progress }) => ({
        name: user.name,
        score: progress.totalScore,
        state: user.state,
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 20);

    return {
      stateDistribution,
      genderDistribution,
      leaderboard,
    };
  };

  const roleBreakdowns = {
    teacher: buildRoleBreakdown('teacher'),
    trainer: buildRoleBreakdown('trainer'),
    'senior-trainer': buildRoleBreakdown('senior-trainer'),
    'master-trainer': buildRoleBreakdown('master-trainer'),
  };

  const levelLeaderboards = GROWTH_LEVELS.map((level) => {
    const levelUsers = activeUsers.filter((user) => user.role === level.role);
    return {
      ...level,
      count: levelUsers.length,
      performers: levelUsers
        .map((levelUser) => {
          const progress = getTeacherProgress(levelUser, materials, submissions);
          return {
            name: levelUser.name,
            score: progress.totalScore,
            state: levelUser.state,
          };
        })
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .slice(0, 5),
    };
  }).filter((level) => level.count > 0);

  const stateLeaderboard = STATES.map((state) => {
    const stateEntries = growthProgress.filter((entry) => entry.user.state === state);
    if (stateEntries.length === 0) {
      return { state, score: 0 };
    }

    const score = Math.round(
      stateEntries.reduce((sum, entry) => sum + entry.progress.completionRate, 0) / stateEntries.length,
    );

    return { state, score };
  }).sort((a, b) => b.score - a.score || a.state.localeCompare(b.state));

  const teachersByState = STATES.map((state) => {
    const stateTeachers = teacherProgress.filter((entry) => entry.teacher.state === state);
    const count = stateTeachers.length;
    const activeCount = stateTeachers.filter((entry) => !!entry.teacher.lastLoginAt).length;
    const avgScore = count
      ? Math.round(stateTeachers.reduce((sum, entry) => sum + entry.progress.totalScore, 0) / count)
      : 0;
    const completionRateByState = count
      ? Math.round(
          stateTeachers.reduce((sum, entry) => sum + entry.progress.completionRate, 0) / count,
        )
      : 0;

    return {
      state,
      count,
      activeCount,
      avgScore,
      completionRate: completionRateByState,
    };
  })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state));

  const growthByState = STATES.map((state) => {
    const stateUsers = activeUsers.filter((user) => user.state === state);
    const teachers = stateUsers.filter((user) => user.role === 'teacher').length;
    const trainers = stateUsers.filter((user) => user.role === 'trainer').length;
    const seniorTrainers = stateUsers.filter((user) => user.role === 'senior-trainer').length;
    const masterTrainers = stateUsers.filter((user) => user.role === 'master-trainer').length;

    return {
      state,
      teachers,
      trainers,
      seniorTrainers,
      masterTrainers,
      total: teachers + trainers + seniorTrainers + masterTrainers,
    };
  }).sort((a, b) => b.total - a.total || a.state.localeCompare(b.state));

  return {
    enrollment,
    trainerCount,
    seniorTrainerCount,
    masterTrainerCount,
    completionRate,
    activeTeachers,
    genderDistribution,
    teacherLeaderboard,
    roleBreakdowns,
    levelLeaderboards,
    stateLeaderboard,
    teachersByState,
    growthByState,
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
  const teachers = users.filter((user) =>
    !user.archived && ['teacher', 'trainer', 'senior-trainer', 'master-trainer'].includes(user.role),
  );
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

  batch.set(doc(db, 'stats', 'global'), buildTrainingStats(users, materials, submissions), { merge: true });
  await batch.commit();
}
