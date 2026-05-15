import { LearningMaterial } from '../types';

export function getMaterialCreatedAtTime(material: LearningMaterial) {
  const createdAtTime = Date.parse(material.createdAt || '');
  return Number.isFinite(createdAtTime) ? createdAtTime : 0;
}

export function sortMaterialsByNewest<T extends LearningMaterial>(materials: T[]) {
  return materials.slice().sort((a, b) => {
    const createdAtDifference = getMaterialCreatedAtTime(b) - getMaterialCreatedAtTime(a);

    if (createdAtDifference !== 0) {
      return createdAtDifference;
    }

    return a.title.localeCompare(b.title);
  });
}
