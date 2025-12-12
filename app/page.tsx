import { redirect } from "next/navigation";

export default function Home() {
  // Redireciona para o login ou dashboard
  redirect("/login");
}
