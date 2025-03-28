import { redirect } from "next/navigation";

export default function DashboardPage() {
  redirect("/");
  
  // This code won't be executed because of the redirect
  return null;
} 