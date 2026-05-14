import * as XLSX from 'xlsx';
import { ImportedScoreRow } from '../types';

const normalizeFieldKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

function getField(row: Record<string, unknown>, keys: string[]) {
  const normalized = Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[normalizeFieldKey(key)] = value;
    return acc;
  }, {});

  for (const key of keys) {
    const candidate = normalized[normalizeFieldKey(key)];
    if (candidate !== undefined && candidate !== null && String(candidate).trim() !== '') {
      return candidate;
    }
  }

  return undefined;
}

function parseString(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function parseScore(value: unknown): number {
  if (value === undefined || value === null) {
    return NaN;
  }

  if (typeof value === 'number') {
    return value;
  }

  const match = String(value).trim().match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function parseWeek(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'number' && !Number.isNaN(value)) {
    return Math.round(value);
  }

  const parsed = String(value).trim();
  const match = parsed.match(/\d+/);
  if (!match) {
    return undefined;
  }

  const week = Number(match[0]);
  return Number.isNaN(week) ? undefined : week;
}

function parseDate(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'number') {
    const excelEpoch = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!Number.isNaN(excelEpoch.getTime())) {
      return excelEpoch.toISOString();
    }
    return undefined;
  }

  const parsed = new Date(String(value).trim());
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export async function parseAssessmentImportFile(file: File): Promise<ImportedScoreRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  return rawRows.map((row) => {
    const teacherEmail = parseString(
      getField(row, [
        'email',
        'teacher email',
        'teacheremail',
        'user email',
        'email address',
        'emailaddress',
      ]),
    );
    const score = parseScore(
      getField(row, ['score', 'marks', 'mark', 'grade', 'score (0-100)', 'score(0-100)']),
    );
    const week = parseWeek(
      getField(row, ['week', 'wk', 'week number', 'weekno', 'weeknumber']),
    );
    const feedback = parseString(
      getField(row, ['feedback', 'comment', 'comments', 'remarks', 'notes']),
    );
    const materialId = parseString(
      getField(row, [
        'material id',
        'assignment id',
        'materialid',
        'assignmentid',
        'assessment id',
      ]),
    );
    const materialTitle = parseString(
      getField(row, [
        'material title',
        'assignment title',
        'title',
        'assessment title',
      ]),
    );
    const contentUrl = parseString(
      getField(row, ['content url', 'submission url', 'response url', 'url', 'link']),
    );
    const submittedAt = parseDate(
      getField(row, [
        'submitted at',
        'submission date',
        'date',
        'submittedat',
        'response date',
      ]),
    );

    return {
      teacherEmail,
      score,
      week,
      feedback: feedback || undefined,
      materialId: materialId || undefined,
      materialTitle: materialTitle || undefined,
      contentUrl: contentUrl || undefined,
      submittedAt: submittedAt || undefined,
    };
  });
}
