/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the main API when not using the vite dev proxy. */
  readonly VITE_API_BASE?: string;
  /** Default path pre-filled in the server file browser for source files. */
  readonly VITE_SOURCE_DEFAULT_PATH?: string;
  /** Default path pre-filled in the server file browser for target files. */
  readonly VITE_TARGET_DEFAULT_PATH?: string;
  /** Root of the recovered banking test data pack, if used. */
  readonly VITE_BANKING_PACK_PATH?: string;
  /** Location of the discovery business-rules file used by auto-orchestration. */
  readonly VITE_BUSINESS_RULES_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

