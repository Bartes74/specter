/**
 * POST /api/projects/pick-folder — lokalny natywny wybór folderu.
 *
 * Działa tylko dla aplikacji uruchomionej lokalnie. Gdy systemowy dialog nie jest
 * dostępny, klient powinien pokazać manual path fallback.
 */
import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import { errorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);

export async function POST() {
  try {
    const platform = os.platform();
    let stdout = '';

    if (platform === 'darwin') {
      const result = await execFileAsync('osascript', [
        '-e',
        'POSIX path of (choose folder with prompt "Wybierz folder projektu dla Spec Generator")',
      ]);
      stdout = result.stdout;
    } else if (platform === 'win32') {
      const script = [
        'Add-Type -AssemblyName System.Windows.Forms',
        '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
        '$dialog.Description = "Wybierz folder projektu dla Spec Generator"',
        'if ($dialog.ShowDialog() -eq "OK") { Write-Output $dialog.SelectedPath }',
      ].join('; ');
      const result = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script]);
      stdout = result.stdout;
    } else {
      const picker = await findLinuxPicker();
      if (!picker) {
        return errorResponse(501, 'PICKER_UNAVAILABLE', 'No supported folder picker found');
      }
      const result =
        picker === 'zenity'
          ? await execFileAsync('zenity', ['--file-selection', '--directory', '--title=Spec Generator'])
          : await execFileAsync('kdialog', ['--getexistingdirectory', process.env.HOME ?? '/']);
      stdout = result.stdout;
    }

    const projectPath = stdout.trim();
    if (!projectPath) {
      return errorResponse(499, 'PICKER_CANCELLED', 'Folder selection cancelled');
    }
    return NextResponse.json({ projectPath });
  } catch (err) {
    return errorResponse(500, 'PICKER_FAILED', (err as Error).message);
  }
}

async function findLinuxPicker(): Promise<'zenity' | 'kdialog' | null> {
  for (const command of ['zenity', 'kdialog'] as const) {
    try {
      await execFileAsync('which', [command]);
      return command;
    } catch {
      // try next
    }
  }
  return null;
}
