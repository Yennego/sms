export interface Tenant {
  id: string;
  name: string;
  code?: string;
  domain?: string | null;
  subdomain?: string | null;
  logo?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  plan_type?: string;
  plan_amount?: number;
  subscription_status?: string;
  features?: {
    enable_finance: boolean;
    enable_transportation: boolean;
    enable_cafeteria: boolean;
    enable_health: boolean;
    enable_parent_portal: boolean;
    enable_sms_notifications: boolean;
    [key: string]: boolean;
  };
}

export interface TenantCreate {
  name: string;
  code: string;
  domain?: string;
  subdomain?: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  isActive?: boolean;
  created_at?: string;
  updated_at?: string;
  plan_type?: string;
  plan_amount?: number;
  subscription_status?: string;
}

export interface TenantUpdate {
  name?: string;
  code?: string;
  domain?: string;
  subdomain?: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  isActive?: boolean;
  plan_type?: string;
  plan_amount?: number;
  subscription_status?: string;
}

export interface AdminUserData {
  first_name: string;
  last_name: string;
  email: string;
  password?: string; // If not provided, password will be generated
}

export interface TenantCreateWithAdmin {
  name: string;
  code: string;
  domain?: string;
  subdomain?: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  isActive?: boolean;
  admin_user: AdminUserData;
}

export interface TenantCreateResponse {
  tenant: Tenant;
  admin_user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
    created_at: string;
    generated_password?: string;
  };
}