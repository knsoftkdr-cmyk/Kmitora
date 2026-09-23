import React from "react";
import KMITORASourceConnectWorkspace from "./KMITORASourceConnectWorkspace";
import { realSourceAdapter } from "./realSourceAdapter";

export default function KMITORASourceConnectLive() {
  return <KMITORASourceConnectWorkspace adapter={realSourceAdapter} />;
}

