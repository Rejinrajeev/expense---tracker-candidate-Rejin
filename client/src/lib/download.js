/* =========================================================
   lib/download.js — the browser side of export and import.

   Kept apart from shared/serializer.js so that file stays pure
   and unit testable: this is the Blob, object-URL and FileReader
   work that only a browser can do.
   ========================================================= */

/** Hand the user a generated file as a download. */
export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });

  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke late: Safari needs the URL to outlive the click.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Read a picked file as text. Rejects with a user-facing message. */
export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read the file."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(file);
  });
}
