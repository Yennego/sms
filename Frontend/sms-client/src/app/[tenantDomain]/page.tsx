import RoleHomeRedirect from '@/components/layout/role-home-redirect';

// /{school}: the school is resolved by the layout; send each role to its home page
export default function SchoolRootPage() {
  return <RoleHomeRedirect />;
}
