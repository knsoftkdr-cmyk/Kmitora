import type { ConnectorCategory } from "../models/MigrationTopology";

export type ConnectorDefinition = {
  id: string;
  name: string;
  category: ConnectorCategory;
  sourceSupported: boolean;
  targetSupported: boolean;
  liveAdapter: boolean;
};

export const connectorRegistry: ConnectorDefinition[] = [
  { id: "oracle", name: "Oracle", category: "DATABASE", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "postgresql", name: "PostgreSQL", category: "DATABASE", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "sqlserver", name: "SQL Server", category: "DATABASE", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "mysql", name: "MySQL", category: "DATABASE", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "mariadb", name: "MariaDB", category: "DATABASE", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "db2", name: "IBM DB2", category: "DATABASE", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "teradata", name: "Teradata", category: "DATABASE", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "sybase", name: "Sybase", category: "DATABASE", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "access", name: "Microsoft Access", category: "DATABASE", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "informix", name: "Informix", category: "DATABASE", sourceSupported: true, targetSupported: true, liveAdapter: false },

  { id: "excel", name: "Excel", category: "FILE", sourceSupported: true, targetSupported: true, liveAdapter: true },
  { id: "csv", name: "CSV", category: "FILE", sourceSupported: true, targetSupported: true, liveAdapter: true },
  { id: "flatfile", name: "Flat File", category: "FILE", sourceSupported: true, targetSupported: true, liveAdapter: true },
  { id: "fixedwidth", name: "Fixed Width", category: "FILE", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "json", name: "JSON", category: "FILE", sourceSupported: true, targetSupported: true, liveAdapter: true },
  { id: "xml", name: "XML", category: "FILE", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "parquet", name: "Parquet", category: "FILE", sourceSupported: true, targetSupported: true, liveAdapter: true },
  { id: "avro", name: "Avro", category: "FILE", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "orc", name: "ORC", category: "FILE", sourceSupported: true, targetSupported: true, liveAdapter: false },

  { id: "snowflake", name: "Snowflake", category: "DATA_WAREHOUSE", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "redshift", name: "Amazon Redshift", category: "DATA_WAREHOUSE", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "bigquery", name: "Google BigQuery", category: "DATA_WAREHOUSE", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "synapse", name: "Azure Synapse", category: "DATA_WAREHOUSE", sourceSupported: true, targetSupported: true, liveAdapter: false },

  { id: "hadoop", name: "Hadoop", category: "BIG_DATA", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "hive", name: "Apache Hive", category: "BIG_DATA", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "hbase", name: "Apache HBase", category: "BIG_DATA", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "spark", name: "Apache Spark", category: "BIG_DATA", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "databricks", name: "Databricks", category: "BIG_DATA", sourceSupported: true, targetSupported: true, liveAdapter: false },

  { id: "s3", name: "Amazon S3", category: "CLOUD_STORAGE", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "azureblob", name: "Azure Blob Storage", category: "CLOUD_STORAGE", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "gcs", name: "Google Cloud Storage", category: "CLOUD_STORAGE", sourceSupported: true, targetSupported: true, liveAdapter: false },

  { id: "rest", name: "REST API", category: "API", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "soap", name: "SOAP API", category: "API", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "graphql", name: "GraphQL", category: "API", sourceSupported: true, targetSupported: true, liveAdapter: false },

  { id: "sap", name: "SAP", category: "APPLICATION", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "oracle-ebs", name: "Oracle E-Business Suite", category: "APPLICATION", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "peoplesoft", name: "PeopleSoft", category: "APPLICATION", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "salesforce", name: "Salesforce", category: "SAAS", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "servicenow", name: "ServiceNow", category: "SAAS", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "workday", name: "Workday", category: "SAAS", sourceSupported: true, targetSupported: true, liveAdapter: false },

  { id: "mainframe-db2", name: "Mainframe DB2", category: "MAINFRAME", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "vsam", name: "VSAM", category: "MAINFRAME", sourceSupported: true, targetSupported: false, liveAdapter: false },

  { id: "kafka", name: "Apache Kafka", category: "MESSAGING", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "mq", name: "IBM MQ", category: "MESSAGING", sourceSupported: true, targetSupported: true, liveAdapter: false },

  { id: "informatica", name: "Informatica", category: "ETL_INTEGRATION", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "abinitio", name: "Ab Initio", category: "ETL_INTEGRATION", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "datastage", name: "IBM DataStage", category: "ETL_INTEGRATION", sourceSupported: true, targetSupported: true, liveAdapter: false },
  { id: "ssis", name: "SSIS", category: "ETL_INTEGRATION", sourceSupported: true, targetSupported: true, liveAdapter: false },

  { id: "custom", name: "Custom / Other", category: "CUSTOM", sourceSupported: true, targetSupported: true, liveAdapter: false }
];

export const connectorCategories: { value: ConnectorCategory; label: string }[] = [
  { value: "DATABASE", label: "Database" },
  { value: "FILE", label: "File" },
  { value: "DATA_WAREHOUSE", label: "Data Warehouse" },
  { value: "BIG_DATA", label: "Big Data" },
  { value: "CLOUD_STORAGE", label: "Cloud Storage" },
  { value: "API", label: "API" },
  { value: "APPLICATION", label: "Enterprise Application" },
  { value: "SAAS", label: "SaaS" },
  { value: "MAINFRAME", label: "Mainframe" },
  { value: "MESSAGING", label: "Messaging / Streaming" },
  { value: "ETL_INTEGRATION", label: "ETL / Integration" },
  { value: "CUSTOM", label: "Custom / Other" }
];

