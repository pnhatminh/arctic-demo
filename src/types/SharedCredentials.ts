export interface SharedCredentials {
  id: string;
  service_name: string;
  allow_list: Map<string, AccessType>;
  blob_id?: string;
}

export type AccessType = "Owner" | "Read" | "ReadWrite";
