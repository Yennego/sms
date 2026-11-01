import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { UsersScreen } from '@/components/users/users-screen';

// Search, filters and page live in the URL (nuqs), like the platform's Users page
export default function AdminUsersPage() {
  return (
    <NuqsAdapter>
      <UsersScreen />
    </NuqsAdapter>
  );
}
