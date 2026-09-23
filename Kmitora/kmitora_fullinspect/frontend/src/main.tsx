import { createRoot } from "react-dom/client";
import { installRuntimeCertification } from "./lib/runtimeCertification";
import "./styles/kmitora-typography.css"
import "./styles/kmitora-ui-conformity-r1.css"
import React from "react";

import App from "./App";
import "./styles.css";
import "./styles/kmitora-responsive-visual-consistency.css"
import "./styles/kmitora-motion.css";
installRuntimeCertification();


createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);




