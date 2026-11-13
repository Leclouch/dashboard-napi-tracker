import SetPasswordPage from "@/components/SetPasswordPage";

// See src/app/page.tsx: the app renders in the browser only, so this check doesn't apply.
export const instant = false;

export default function InvitePage() {
  return <SetPasswordPage mode="invite" />;
}
