import React from "react";
import KMITORASourceConnectWorkspace from "./KMITORASourceConnectWorkspace";
import { demoSourceAdapter } from "./demoAdapter";

export default function KMITORASourceConnectDemo() {
  return <KMITORASourceConnectWorkspace adapter={demoSourceAdapter} />;
}
