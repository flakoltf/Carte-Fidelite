#!/usr/bin/env node
// Hook SessionStart — Briefing de reprise inter-session / multi-machine.
//
// 100 % Node (aucune syntaxe shell) => fonctionne sur macOS, Windows et Linux.
// La "mémoire" voyage via git : ce hook se contente de LIRE l'état du dépôt
// (branche, derniers commits, fin du journal de bord) et de l'injecter dans le
// contexte de la session. Il n'écrit rien et ne doit jamais bloquer le démarrage.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

// execFileSync (sans shell) => pas de souci de guillemets ni d'expansion de
// "%" sous cmd.exe. Renvoie "" en cas d'échec plutôt que de planter.
function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: projectDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function emit(context) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: context,
      },
    })
  );
}

try {
  const parts = [];

  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch) parts.push(`• Branche courante : ${branch}`);

  const status = git(["status", "--short", "--branch"]);
  if (status) parts.push(`• État git :\n${status}`);

  const log = git(["log", "-8", "--pretty=format:  - %h %s (%cr)"]);
  if (log) parts.push(`• 8 derniers commits :\n${log}`);

  const journalPath = join(projectDir, "docs", "JOURNAL.md");
  if (existsSync(journalPath)) {
    const tail = readFileSync(journalPath, "utf8")
      .split(/\r?\n/)
      .slice(-45)
      .join("\n")
      .trim();
    if (tail) parts.push(`• Fin de docs/JOURNAL.md (mémoire de la dernière session) :\n${tail}`);
  } else {
    parts.push("• docs/JOURNAL.md introuvable — à créer pour la mémoire inter-session.");
  }

  emit(
    [
      "📌 BRIEFING DE REPRISE (hook SessionStart — contexte lu depuis git) :",
      "",
      parts.join("\n\n"),
      "",
      "👉 Tiens compte de ce qui précède avant d'agir. En fin de session : mets à jour " +
        "docs/JOURNAL.md (ce qui a été fait + prochaines étapes), puis commit & push.",
    ].join("\n")
  );
} catch (err) {
  // Filet de sécurité : ne jamais empêcher la session de démarrer.
  emit(`Briefing SessionStart indisponible (${String(err)}).`);
}
