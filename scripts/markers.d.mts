export const MARKER_RE: RegExp;
export function findMarkers(root?: string): { file: string; line: number; text: string }[];
export function formatMarkers(markers: { file: string; line: number; text: string }[]): string;
export const CV_LOCK: string;
export function cvFingerprint(root?: string): string;
export function cvPdfsUpToDate(root?: string): boolean;
