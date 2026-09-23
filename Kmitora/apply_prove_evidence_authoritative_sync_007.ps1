$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Project = $Root
$Premium = Join-Path $Project "frontend\src\components\EvidencePremiumWorkspace.tsx"
$Service = Join-Path $Project "frontend\src\services\authoritativeEvidenceProjection.ts"

if (-not (Test-Path $Premium)) { throw "EvidencePremiumWorkspace.tsx not found: $Premium" }
if (-not (Test-Path $Service)) { throw "authoritativeEvidenceProjection.ts missing from patch." }

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item $Premium "$Premium.bak_PROVE_EVIDENCE_AUTHORITATIVE_SYNC_007_$stamp" -Force

$text = Get-Content $Premium -Raw

if ($text -notmatch 'PROVE_EVIDENCE_AUTHORITATIVE_SYNC_007') {
    # Ensure useEffect is imported from React.
    if ($text -match 'import \{([^}]*)\} from "react";') {
        $imports = $Matches[1]
        if ($imports -notmatch '\buseEffect\b') {
            $newImports = ($imports.Trim() + ', useEffect')
            $text = [regex]::Replace($text, 'import \{[^}]*\} from "react";', "import { $newImports } from `"react`";", 1)
        }
    } else {
        throw "Unable to locate React import in EvidencePremiumWorkspace.tsx"
    }

    if ($text -notmatch 'authoritativeEvidenceProjection') {
        $anchor = 'import "../styles/'
        $idx = $text.IndexOf($anchor)
        if ($idx -lt 0) { throw "Unable to locate style import anchor in EvidencePremiumWorkspace.tsx" }
        $text = $text.Insert($idx, 'import { loadAuthoritativeEvidenceProjection } from "../services/authoritativeEvidenceProjection";' + "`r`n")
    }

    # Add authoritative server evidence state after refreshToken.
    $statePattern = 'const \[refreshToken, setRefreshToken\] = useState\(0\);'
    if ($text -notmatch $statePattern) { throw "refreshToken state anchor not found in EvidencePremiumWorkspace.tsx" }
    $stateReplacement = @'
const [refreshToken, setRefreshToken] = useState(0);
  const [authoritativeEvidence, setAuthoritativeEvidence] = useState<any | null>(null);

  // PROVE_EVIDENCE_AUTHORITATIVE_SYNC_007
  // Operations evidence is server-first. Browser storage is bootstrap metadata only.
  useEffect(() => {
    let cancelled = false;
    void loadAuthoritativeEvidenceProjection().then((next) => {
      if (!cancelled) setAuthoritativeEvidence(next);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);
'@
    $text = [regex]::Replace($text, $statePattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $stateReplacement }, 1)

    # Replace compact browser evidence source with authoritative package.
    $evidencePattern = 'const evidence = readJson<any>\("kmitora\.dev\.lastEvidence", null\);'
    if ($text -notmatch $evidencePattern) {
        throw "Evidence localStorage anchor not found. Refusing unsafe blind patch."
    }
    $evidenceReplacement = 'const evidence = authoritativeEvidence ?? readJson<any>("kmitora.dev.lastEvidence", null);'
    $text = [regex]::Replace($text, $evidencePattern, $evidenceReplacement, 1)

    # Make snapshot recompute once server evidence arrives.
    if ($text -match '\}, \[refreshToken\]\);') {
        $text = [regex]::Replace($text, '\}, \[refreshToken\]\);', '}, [refreshToken, authoritativeEvidence]);', 1)
    } elseif ($text -match '\}, \[([^\]]*refreshToken[^\]]*)\]\);') {
        $text = [regex]::Replace(
            $text,
            '\}, \[([^\]]*refreshToken[^\]]*)\]\);',
            { param($m)
                $deps = $m.Groups[1].Value
                if ($deps -notmatch 'authoritativeEvidence') { $deps = $deps.Trim() + ', authoritativeEvidence' }
                "}, [$deps]);"
            },
            1
        )
    } else {
        throw "Unable to locate snapshot dependency list in EvidencePremiumWorkspace.tsx"
    }

    Set-Content -Path $Premium -Value $text -Encoding UTF8
}

Write-Host "PROVE_EVIDENCE_AUTHORITATIVE_SYNC_007 applied." -ForegroundColor Green
Write-Host "EvidencePremiumWorkspace now consumes server-first A000 evidence and identity-bound proof enrichment." -ForegroundColor Green
