import { redirect } from "next/navigation";

export default function UsersIndex() {
  redirect("/users/dashboard");
}
