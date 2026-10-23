// Hands the photo taken on Home to the Locate screen without re-asking for it.
let photo: File | null = null;

export function setPendingPhoto(file: File) {
  photo = file;
}

export function peekPendingPhoto(): File | null {
  return photo;
}

export function clearPendingPhoto() {
  photo = null;
}
