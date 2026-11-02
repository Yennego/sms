import { redirect } from 'next/navigation';

// The plain app address has no school in it: send people to "Find your school" (/login), which
// opens the school this browser used last or finds the one they type.
export default function RootPage() {
  redirect('/login');
}
