import React from "react";
import KMITORATargetConnectWorkspace from "./KMITORATargetConnectWorkspace";
import { realTargetAdapter } from "./realTargetAdapter";

export default function KMITORATargetConnectLive() {
  return <KMITORATargetConnectWorkspace adapter={realTargetAdapter} />;
}

