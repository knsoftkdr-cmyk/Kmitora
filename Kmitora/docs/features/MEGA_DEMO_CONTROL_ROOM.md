# KMITORA Mega Enterprise Control Room

## Purpose

Client-facing visualization of the same backend Mega Enterprise E2E scenario.
The UI does not invent a separate demo path.

## Operations menu

`Operations → Mega Demo Control Room`

## Modes

- **Run Live Backend Demo** starts the safe backend Mega E2E runner through A000.
- **Replay Latest Evidence** animates the latest saved 121-check backend report.

## Backend APIs

- `GET /v1/a000/mega-demo/status`
- `POST /v1/a000/mega-demo/start`
- `GET /v1/a000/mega-demo/report`

The status endpoint exposes parsed live check progress while the runner executes.

## Client-facing views

- backend status and 121-check progress;
- 13-stage lifecycle rail;
- Domain Intelligence context;
- A000 dynamic agent allocation;
- Digital Twin impact/RCA/simulation summary;
- capability/KQA assurance summary;
- governed migration evidence chain;
- report SHA-256;
- explicit PROD DENIED safety state.

## Safety

The control room invokes the existing backend Mega E2E reference runner. It does
not authorize production writes, destructive actions, cutover or policy bypass.

## Local run

Start backend on port 8080 and frontend on port 5173, then:

```powershell
$Repo = "C:\KMITORA\KmitoraBuild_A000_1M_UI_13Stage_Full_Integrated\Kmitora"
Set-Location $Repo
.\run-mega-demo-control-room-e2e.ps1
```
