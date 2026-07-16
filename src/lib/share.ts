/**
 * The paper way out, for any file the notebook produces.
 *
 * localStorage is one factory reset from gone. On phones the share sheet is the
 * native exit (Files, mail, a message to herself); anywhere else each file
 * downloads. Lifted out of KeptPage so the yard sheet can leave by the same
 * door the notebook does.
 */
export async function shareFiles(files: File[]) {
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files });
      return;
    } catch {
      /* she closed the sheet, or the share failed; fall through to download */
    }
  }
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }
}
