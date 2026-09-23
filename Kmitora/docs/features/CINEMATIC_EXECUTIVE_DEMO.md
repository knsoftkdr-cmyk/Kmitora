# KMITORA Cinematic Executive Demo

## Purpose

A fullscreen executive presentation mode layered on top of KMITORA's existing
Mega Demo evidence. It is designed for client presentations, workshops and
future sales demonstrations.

## Navigation

`Operations → Cinematic Executive Demo`

## Presentation controls

- Client scenario selector
- Play / pause
- Previous / next scene
- Restart
- Presentation speed
- Fullscreen
- Reload evidence
- Run Live Backend

## Nine cinematic scenes

1. Enterprise transformation, under control
2. Client context and Domain Intelligence
3. A000 specialist orchestration
4. Enterprise Digital Twin
5. 13-stage lifecycle
6. Governance gates
7. 1M capability + KQA assurance
8. Governed transformation chain
9. Executive evidence and proof

## Client presets

The UI includes six demo presets:

- Banking & Financial Services
- Insurance
- Telecommunications
- Healthcare & Life Sciences
- Manufacturing
- Government / Public Sector

Each preset changes the executive theme, client profile, systems, processes,
risks, KPIs, specialist-agent emphasis, Digital Twin focus and presenter cues.

## Evidence boundary

The client preset is a presentation context. The evidence displayed is explicitly
reference-runtime evidence unless a client-specific validated run has been
executed. Never describe a preset as client production evidence without such a run.

## Local validation

```powershell
$Repo = "C:\KMITORA\KmitoraBuild_A000_1M_UI_13Stage_Full_Integrated\Kmitora"
Set-Location $Repo
.\run-cinematic-executive-demo-e2e.ps1
```
