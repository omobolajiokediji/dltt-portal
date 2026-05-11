import { collection, doc, Firestore, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { Auth } from 'firebase/auth';
import { PortalSettings } from '../types';

export const portalSettingsDocPath = 'settings/portal';
const legacyPortalSettingsDocPath = 'stats/global';
const fallbackPortalSettingsDocPath = 'users/{currentSuperAdminUid}';

export function getTeacherProfileEditingDisabled(settings: Partial<PortalSettings> | undefined) {
  return settings?.teacherProfileEditingDisabled === true;
}

function getDefinedTeacherProfileEditingDisabled(settings: Partial<PortalSettings> | undefined) {
  return typeof settings?.teacherProfileEditingDisabled === 'boolean'
    ? settings.teacherProfileEditingDisabled
    : undefined;
}

export function subscribeToPortalSettings(
  db: Firestore,
  onChange: (settings: PortalSettings) => void,
  onError: (error: unknown) => void,
) {
  let primarySettings: Partial<PortalSettings> | undefined;
  let superAdminSettings: Partial<PortalSettings> | undefined;
  let legacySettings: Partial<PortalSettings> | undefined;

  const emitSettings = () => {
    const disabled =
      getDefinedTeacherProfileEditingDisabled(primarySettings) ??
      getDefinedTeacherProfileEditingDisabled(superAdminSettings) ??
      getDefinedTeacherProfileEditingDisabled(legacySettings) ??
      false;

    onChange({
      teacherProfileEditingDisabled: disabled,
    });
  };

  const unsubscribePrimary = onSnapshot(
    doc(db, 'settings', 'portal'),
    (snapshot) => {
      primarySettings = snapshot.data() as Partial<PortalSettings> | undefined;
      emitSettings();
    },
    () => {
      primarySettings = undefined;
      emitSettings();
    },
  );

  const unsubscribeSuperAdmin = onSnapshot(
    query(collection(db, 'users'), where('role', '==', 'super-admin')),
    (snapshot) => {
      superAdminSettings = snapshot.docs
        .map((item) => item.data() as Partial<PortalSettings>)
        .find((settings) => getDefinedTeacherProfileEditingDisabled(settings) !== undefined);
      emitSettings();
    },
    onError,
  );

  const unsubscribeLegacy = onSnapshot(
    doc(db, 'stats', 'global'),
    (snapshot) => {
      legacySettings = snapshot.data() as Partial<PortalSettings> | undefined;
      emitSettings();
    },
    onError,
  );

  return () => {
    unsubscribePrimary();
    unsubscribeSuperAdmin();
    unsubscribeLegacy();
  };
}

export async function saveTeacherProfileEditingDisabled(db: Firestore, auth: Auth, disabled: boolean) {
  const payload = {
    teacherProfileEditingDisabled: disabled,
    teacherProfileEditingUpdatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'settings', 'portal'), payload, { merge: true });
  } catch (error) {
    if (!auth.currentUser?.uid) {
      throw error;
    }

    await setDoc(doc(db, 'users', auth.currentUser.uid), payload, { merge: true });
  }
}

export function describePortalSettingsStorage() {
  return `${portalSettingsDocPath} or ${fallbackPortalSettingsDocPath}`;
}

export function clearLegacyTeacherProfileEditingDisabled(db: Firestore) {
  return setDoc(
    doc(db, legacyPortalSettingsDocPath),
    {
      teacherProfileEditingDisabled: false,
    },
    { merge: true },
  );
}
